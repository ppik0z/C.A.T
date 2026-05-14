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

const getToken = () => localStorage.getItem('accessToken');

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
    async refreshAll() {
      const token = getToken();
      if (!token) return;
      if (this.refreshPromise) return this.refreshPromise;

      this.isLoading = true;
      this.error = null;

      this.refreshPromise = (async () => {
        try {
          const [friends, incomingRequests, outgoingRequests, suggestions] = await Promise.all([
            fetchFriends(token),
            fetchFriendRequests(token, 'incoming'),
            fetchFriendRequests(token, 'outgoing'),
            fetchFriendSuggestions(token),
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
      const token = getToken();
      if (!token) return;

      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        this.searchResults = [];
        return;
      }

      try {
        this.searchResults = await searchFriends(token, normalizedQuery);
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Không thể tìm kiếm người dùng';
      }
    },

    async sendRequest(userId: number) {
      await this.runMutation((token) => sendFriendRequest(token, userId));
    },

    async cancelRequest(userId: number) {
      await this.runMutation((token) => cancelFriendRequest(token, userId));
    },

    async acceptRequest(userId: number) {
      await this.runMutation((token) => acceptFriendRequest(token, userId));
    },

    async rejectRequest(userId: number) {
      await this.runMutation((token) => rejectFriendRequest(token, userId));
    },

    async removeFriend(userId: number) {
      await this.runMutation((token) => removeFriendRequest(token, userId));
    },

    async runMutation(action: (token: string) => Promise<void>) {
      const token = getToken();
      if (!token) return;

      this.error = null;
      try {
        await action(token);
        await this.refreshAll();
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Không thể cập nhật bạn bè';
      }
    },
  },
});
