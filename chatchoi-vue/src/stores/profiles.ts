import { defineStore } from 'pinia';
import { fetchPublicProfile } from '../services/account.service';
import type { PublicUserProfile } from '../types/account';

const PROFILE_TTL_MS = 60_000;

export const useProfilesStore = defineStore('profiles', {
  state: () => ({
    profilesByUserId: {} as Record<number, PublicUserProfile>,
    fetchedAtByUserId: {} as Record<number, number>,
    requestsByUserId: {} as Record<number, Promise<PublicUserProfile> | undefined>,
  }),

  actions: {
    applyProfile(profile: PublicUserProfile) {
      this.profilesByUserId[profile.id] = profile;
      this.fetchedAtByUserId[profile.id] = Date.now();
    },

    invalidate(userId: number) {
      delete this.fetchedAtByUserId[userId];
    },

    async loadProfile(userId: number, force = false) {
      const cached = this.profilesByUserId[userId];
      const fetchedAt = this.fetchedAtByUserId[userId] ?? 0;
      if (!force && cached && Date.now() - fetchedAt < PROFILE_TTL_MS) return cached;
      if (!force && this.requestsByUserId[userId]) return this.requestsByUserId[userId];

      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('Bạn cần đăng nhập để tải hồ sơ người dùng');

      const request = fetchPublicProfile(token, userId)
        .then((profile) => {
          this.applyProfile(profile);
          return profile;
        })
        .finally(() => {
          delete this.requestsByUserId[userId];
        });

      this.requestsByUserId[userId] = request;
      return request;
    },
  },
});
