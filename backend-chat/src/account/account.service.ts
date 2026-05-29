import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { users, userProfiles, userSettings } from '../database/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import 'multer';
import { UpdateProfileDto, UpdateSettingsDto, UpdatePasswordDto } from './dto/account.dto';

@Injectable()
export class AccountService {
  constructor(private readonly drizzle: DrizzleService) {
    cloudinary.config({ secure: true });
  }

  async getMe(userId: number) {
    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        profile: true,
        settings: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const { password: _password, refreshToken: _refreshToken, ...safeUser } = user;
    return safeUser;
  }

  async updateProfile(userId: number, data: UpdateProfileDto) {
    const { displayName, bio, customStatus, email, phone } = data;

    if (email !== undefined || phone !== undefined) {
      const updateData: Partial<typeof users.$inferInsert> = {};
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      await this.drizzle.db.update(users).set(updateData).where(eq(users.id, userId));
    }

    const existingProfile = await this.drizzle.db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });

    const profileData: Partial<typeof userProfiles.$inferInsert> = {};
    if (displayName !== undefined) profileData.displayName = displayName;
    if (bio !== undefined) profileData.bio = bio;
    if (customStatus !== undefined) profileData.customStatus = customStatus;

    if (Object.keys(profileData).length > 0) {
      if (existingProfile) {
        await this.drizzle.db.update(userProfiles).set(profileData).where(eq(userProfiles.userId, userId));
      } else {
        await this.drizzle.db.insert(userProfiles).values({
          userId,
          ...profileData,
        });
      }
    }

    return this.getMe(userId);
  }

  async updateSettings(userId: number, data: UpdateSettingsDto) {
    const existingSettings = await this.drizzle.db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });

    const settingsData: Partial<typeof userSettings.$inferInsert> = {};
    if (data.theme !== undefined) settingsData.theme = data.theme;
    if (data.language !== undefined) settingsData.language = data.language;
    if (data.notificationSound !== undefined) settingsData.notificationSound = data.notificationSound;
    if (data.status !== undefined) settingsData.status = data.status;

    if (Object.keys(settingsData).length > 0) {
      if (existingSettings) {
        await this.drizzle.db.update(userSettings).set(settingsData).where(eq(userSettings.userId, userId));
      } else {
        await this.drizzle.db.insert(userSettings).values({
          userId,
          ...settingsData,
        });
      }
    }

    return this.getMe(userId);
  }

  async updateAvatar(userId: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('File is too large (max 5MB)');

    const result = await new Promise<UploadApiResponse>((resolveUpload, rejectUpload) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `avatars/${userId}`, resource_type: 'image', format: 'webp' },
        (error, result) => {
          if (error) rejectUpload(error instanceof Error ? error : new Error(error?.message || 'Upload failed'));
          else if (result) resolveUpload(result);
          else rejectUpload(new Error('Upload failed: no result'));
        },
      );
      Readable.from(file.buffer).pipe(uploadStream);
    });

    const avatarUrl = result.secure_url;
    await this.drizzle.db.update(users).set({ avatar: avatarUrl }).where(eq(users.id, userId));
    return this.getMe(userId);
  }

  async updatePassword(userId: number, data: UpdatePasswordDto) {
    const { currentPassword, newPassword } = data;
    if (!currentPassword || !newPassword) throw new BadRequestException('Missing password fields');

    const user = await this.drizzle.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new NotFoundException('User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new BadRequestException('Incorrect current password');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.drizzle.db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));

    return { message: 'Password updated successfully' };
  }
}
