import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { users, userProfiles, userSettings } from '../database/schema';
import { and, eq, ne } from 'drizzle-orm';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import 'multer';
import {
  UpdateProfileDto,
  UpdateSettingsDto,
  UpdatePasswordDto,
} from './dto/account.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProfilesService } from '../profiles/profiles.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { PasswordHasherService } from '../auth/password-hasher.service';
import { PushSubscriptionsService } from '../push-notifications/push-subscriptions.service';
import { normalizeEmail } from '../auth/email-address';
import { assertPasswordFitsBcrypt } from '../auth/password-policy';

@Injectable()
export class AccountService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly profilesService: ProfilesService,
    private readonly eventEmitter: EventEmitter2,
    private readonly sessions: AuthSessionService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly pushSubscriptions: PushSubscriptionsService,
  ) {
    cloudinary.config({ secure: true });
  }

  async getMe(userId: number) {
    const [user, publicProfile, settings] = await Promise.all([
      this.drizzle.db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          email: true,
          phone: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.profilesService.getPublicProfile(userId),
      this.drizzle.db.query.userSettings.findFirst({
        where: eq(userSettings.userId, userId),
        columns: {
          id: true,
          userId: true,
          theme: true,
          language: true,
          notificationSound: true,
          showNotificationPreview: true,
          status: true,
          updatedAt: true,
        },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');

    return {
      ...publicProfile,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      settings: settings ?? null,
    };
  }

  async updateProfile(userId: number, data: UpdateProfileDto) {
    const { displayName, bio, customStatus, email, phone } = data;

    // Cập nhật các trường thuộc bảng users (displayName, email, phone)
    const userData: Partial<typeof users.$inferInsert> = {};
    if (displayName !== undefined) userData.displayName = displayName;
    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(email);
      const [currentUser, emailOwner] = await Promise.all([
        this.drizzle.db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { email: true },
        }),
        this.drizzle.db.query.users.findFirst({
          where: and(eq(users.email, normalizedEmail), ne(users.id, userId)),
          columns: { id: true },
        }),
      ]);

      if (!currentUser) throw new NotFoundException('User not found');
      if (emailOwner) throw new ConflictException('Email đã được sử dụng.');
      if (currentUser.email !== normalizedEmail) {
        userData.email = normalizedEmail;
        userData.isEmailVerified = false;
      }
    }
    if (phone !== undefined) userData.phone = phone;

    if (Object.keys(userData).length > 0) {
      try {
        await this.drizzle.db
          .update(users)
          .set(userData)
          .where(eq(users.id, userId));
      } catch (error) {
        if (this.isDuplicateEntryError(error)) {
          throw new ConflictException('Email đã được sử dụng.');
        }
        throw error;
      }
    }

    // Cập nhật các trường thuộc bảng user_profiles (bio, customStatus)
    const profileData: Partial<typeof userProfiles.$inferInsert> = {};
    if (bio !== undefined) profileData.bio = bio;
    if (customStatus !== undefined) profileData.customStatus = customStatus;

    if (Object.keys(profileData).length > 0) {
      const existingProfile =
        await this.drizzle.db.query.userProfiles.findFirst({
          where: eq(userProfiles.userId, userId),
        });

      if (existingProfile) {
        await this.drizzle.db
          .update(userProfiles)
          .set(profileData)
          .where(eq(userProfiles.userId, userId));
      } else {
        await this.drizzle.db.insert(userProfiles).values({
          userId,
          ...profileData,
        });
      }
    }

    await this.emitPublicProfileUpdated(userId);
    return this.getMe(userId);
  }

  async updateSettings(userId: number, data: UpdateSettingsDto) {
    const existingSettings = await this.drizzle.db.query.userSettings.findFirst(
      {
        where: eq(userSettings.userId, userId),
      },
    );

    const settingsData: Partial<typeof userSettings.$inferInsert> = {};
    if (data.theme !== undefined) settingsData.theme = data.theme;
    if (data.language !== undefined) settingsData.language = data.language;
    if (data.notificationSound !== undefined)
      settingsData.notificationSound = data.notificationSound;
    if (data.showNotificationPreview !== undefined)
      settingsData.showNotificationPreview = data.showNotificationPreview;
    if (data.status !== undefined) settingsData.status = data.status;

    if (Object.keys(settingsData).length > 0) {
      if (existingSettings) {
        await this.drizzle.db
          .update(userSettings)
          .set(settingsData)
          .where(eq(userSettings.userId, userId));
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
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('File is too large (max 5MB)');

    const result = await new Promise<UploadApiResponse>(
      (resolveUpload, rejectUpload) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `avatars/${userId}`,
            resource_type: 'image',
            format: 'webp',
          },
          (error, result) => {
            if (error)
              rejectUpload(new Error(error.message || 'Upload failed'));
            else if (result) resolveUpload(result);
            else rejectUpload(new Error('Upload failed: no result'));
          },
        );
        Readable.from(file.buffer).pipe(uploadStream);
      },
    );

    const avatarUrl = result.secure_url;
    await this.drizzle.db
      .update(users)
      .set({ avatar: avatarUrl })
      .where(eq(users.id, userId));
    await this.emitPublicProfileUpdated(userId);
    return this.getMe(userId);
  }

  async updatePassword(userId: number, data: UpdatePasswordDto) {
    const { currentPassword, newPassword } = data;
    if (!currentPassword || !newPassword)
      throw new BadRequestException('Missing password fields');
    assertPasswordFitsBcrypt(newPassword);

    const user = await this.drizzle.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) throw new NotFoundException('User not found');

    const isMatch = await this.passwordHasher.verify(
      currentPassword,
      user.password,
    );
    if (!isMatch) throw new BadRequestException('Incorrect current password');

    const hashedPassword = await this.passwordHasher.hash(newPassword);
    await this.drizzle.db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
    await this.sessions.revokeAllForUser(userId);
    await this.pushSubscriptions.revokeAllForUser(userId);

    return { message: 'Password updated successfully' };
  }

  private async emitPublicProfileUpdated(userId: number) {
    const profile = await this.profilesService.getPublicProfile(userId);
    this.eventEmitter.emit('user.profile.updated', profile);
  }

  private isDuplicateEntryError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { code?: unknown; cause?: { code?: unknown } };
    return (
      candidate.code === 'ER_DUP_ENTRY' ||
      candidate.cause?.code === 'ER_DUP_ENTRY'
    );
  }
}
