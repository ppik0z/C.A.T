import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { userProfiles, users } from '../database/schema';
import { PresenceService } from '../presence/presence.service';

export type PublicPresenceStatus = 'online' | 'offline';

export interface PublicUserSummaryDto {
  id: number;
  username: string;
  displayName: string | null;
  avatar: string | null;
}

export interface PublicUserProfileDto extends PublicUserSummaryDto {
  banner: string | null;
  bio: string | null;
  customStatus: string | null;
  presence: PublicPresenceStatus;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly presenceService: PresenceService,
  ) {}

  async getPublicProfile(userId: number): Promise<PublicUserProfileDto> {
    const [profile] = await this.drizzle.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        banner: userProfiles.banner,
        bio: userProfiles.bio,
        customStatus: userProfiles.customStatus,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(eq(users.id, userId))
      .limit(1);

    if (!profile) throw new NotFoundException('User not found');

    return {
      ...profile,
      presence: await this.getPresence(userId),
    };
  }

  async getPublicSummary(userId: number): Promise<PublicUserSummaryDto> {
    const [user] = await this.drizzle.db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async getPresence(userId: number): Promise<PublicPresenceStatus> {
    return await this.presenceService.isUserOnline(userId) ? 'online' : 'offline';
  }
}
