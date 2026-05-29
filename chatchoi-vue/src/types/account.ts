export interface UserProfile {
  id?: number;
  userId?: number;
  displayName?: string | null;
  bio?: string | null;
  banner?: string | null;
  customStatus?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSettings {
  id?: number;
  userId?: number;
  theme?: string;
  language?: string;
  notificationSound?: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  customStatus?: string;
  email?: string;
  phone?: string;
}
