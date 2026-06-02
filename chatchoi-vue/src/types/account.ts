export type PresenceStatus = 'online' | 'offline';

export interface PublicUserSummary {
  id: number;
  username: string;
  displayName: string | null;
  avatar: string | null;
}

export interface PublicUserProfile extends PublicUserSummary {
  banner: string | null;
  bio: string | null;
  customStatus: string | null;
  presence: PresenceStatus;
}

export interface UserSettings {
  id?: number;
  userId?: number;
  theme?: string;
  language?: string;
  notificationSound?: boolean;
  showNotificationPreview?: boolean;
  status?: string;
  updatedAt?: string;
}

export interface AccountMe extends PublicUserProfile {
  email: string | null;
  phone: string | null;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  settings: UserSettings | null;
}

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  customStatus?: string;
  email?: string;
  phone?: string;
}

export interface UpdateSettingsRequest {
  notificationSound?: boolean;
  showNotificationPreview?: boolean;
}
