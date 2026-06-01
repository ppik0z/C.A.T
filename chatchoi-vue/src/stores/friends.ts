import { defineStore } from 'pinia';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  fetchFriendRequests,
  fetchFriends,
  fetchFriendSuggestions,
  rejectFriendRequest,
  removeFriend as removeFriendRequest,
  searchFriends,
  sendFriendRequest,
} from '../services/friends.service';
import type { FriendRequest, FriendUser } from '../types/friends';
import type { PublicUserProfile } from '../types/account';

export const useFriendsStore = defineStore('friends', {
  state: () => ({
    friends: [] as FriendUser[],
    incomingRequests: [] as FriendRequest[],
    outgoingRequests: [] as FriendRequest[],
    suggestions: [] as FriendUser[],
    searchResults: [] as FriendUser[],
    isLoading: false,
    hasLoaded: false,
    refreshPromise: null as Promise<void> | null,
    error: null as string | null,
  }),

  getters: {
    pendingCount(state): number {
      return state.incomingRequests.length;
    },
  },

  actions: {
    applyUserProfileUpdate(profile: PublicUserProfile) {
      const patchUser = (user: FriendUser) => user.id === profile.id
        ? { ...user, username: profile.username, displayName: profile.displayName, avatar: profile.avatar }
        : user;

      this.friends = this.friends.map(patchUser);
      this.incomingRequests = this.incomingRequests.map(patchUser);
      this.outgoingRequests = this.outgoingRequests.map(patchUser);
      this.suggestions = this.suggestions.map(patchUser);
      this.searchResults = this.searchResults.map(patchUser);
    },

    async refreshAll() {
      if (this.refreshPromise) return this.refreshPromise;

      this.isLoading = true;
      this.error = null;

      this.refreshPromise = (async () => {
        try {
          const [friends, incomingRequests, outgoingRequests, suggestions] = await Promise.all([
            fetchFriends(),
            fetchFriendRequests('incoming'),
            fetchFriendRequests('outgoing'),
            fetchFriendSuggestions(),
          ]);

          this.friends = friends;
          this.incomingRequests = incomingRequests;
          this.outgoingRequests = outgoingRequests;
          this.suggestions = suggestions;
          this.hasLoaded = true;
        } catch (error) {
          this.error = error instanceof Error ? error.message : 'Không thể tải dữ liệu bạn bè';
        } finally {
          this.isLoading = false;
          this.refreshPromise = null;
        }
      })();

      return this.refreshPromise;
    },

    async search(query: string) {
      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        this.searchResults = [];
        return;
      }

      try {
        this.searchResults = await searchFriends(normalizedQuery);
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Không thể tìm kiếm người dùng';
      }
    },

    async sendRequest(userId: number) {
      await this.runMutation(() => sendFriendRequest(userId));
    },

    async cancelRequest(userId: number) {
      await this.runMutation(() => cancelFriendRequest(userId));
    },

    async acceptRequest(userId: number) {
      await this.runMutation(() => acceptFriendRequest(userId));
    },

    async rejectRequest(userId: number) {
      await this.runMutation(() => rejectFriendRequest(userId));
    },

    async removeFriend(userId: number) {
      await this.runMutation(() => removeFriendRequest(userId));
    },

    async runMutation(action: () => Promise<void>) {
      this.error = null;
      try {
        await action();
        await this.refreshAll();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Không thể cập nhật bạn bè';
      }
    },
  },
});
