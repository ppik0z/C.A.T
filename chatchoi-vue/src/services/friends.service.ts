import { apiRequest } from './apiClient';
import type { FriendRequest, FriendUser } from '../types/friends';

export const fetchFriends = () => apiRequest<FriendUser[]>('/friends');
export const fetchFriendRequests = (type: 'incoming' | 'outgoing') => apiRequest<FriendRequest[]>(`/friends/requests?type=${type}`);
export const searchFriends = (query: string) => apiRequest<FriendUser[]>(`/friends/search?q=${encodeURIComponent(query)}`);
export const fetchFriendSuggestions = () => apiRequest<FriendUser[]>('/friends/suggestions');
export const sendFriendRequest = (userId: number) => apiRequest<void>(`/friends/requests/${userId}`, { method: 'POST' });
export const cancelFriendRequest = (userId: number) => apiRequest<void>(`/friends/requests/${userId}`, { method: 'DELETE' });
export const acceptFriendRequest = (userId: number) => apiRequest<void>(`/friends/requests/${userId}/accept`, { method: 'POST' });
export const rejectFriendRequest = (userId: number) => apiRequest<void>(`/friends/requests/${userId}/reject`, { method: 'DELETE' });
export const removeFriend = (userId: number) => apiRequest<void>(`/friends/${userId}`, { method: 'DELETE' });
