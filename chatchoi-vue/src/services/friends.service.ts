import type { FriendRequest, FriendUser } from '../types/friends';
import { apiBaseUrl } from '../config/api';

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Không thể xử lý yêu cầu bạn bè');
  }

  return await response.json() as T;
};

export const fetchFriends = async (token: string): Promise<FriendUser[]> => {
  const response = await fetch(`${apiBaseUrl}/friends`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  return parseResponse<FriendUser[]>(response);
};

export const fetchFriendRequests = async (token: string, type: 'incoming' | 'outgoing'): Promise<FriendRequest[]> => {
  const response = await fetch(`${apiBaseUrl}/friends/requests?type=${type}`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  return parseResponse<FriendRequest[]>(response);
};

export const searchFriends = async (token: string, query: string): Promise<FriendUser[]> => {
  const response = await fetch(`${apiBaseUrl}/friends/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  return parseResponse<FriendUser[]>(response);
};

export const fetchFriendSuggestions = async (token: string): Promise<FriendUser[]> => {
  const response = await fetch(`${apiBaseUrl}/friends/suggestions`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  return parseResponse<FriendUser[]>(response);
};

export const sendFriendRequest = async (token: string, userId: number): Promise<void> => {
  const response = await fetch(`${apiBaseUrl}/friends/requests/${userId}`, {
    method: 'POST',
    headers: authHeaders(token),
  });

  await parseResponse(response);
};

export const cancelFriendRequest = async (token: string, userId: number): Promise<void> => {
  const response = await fetch(`${apiBaseUrl}/friends/requests/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  await parseResponse(response);
};

export const acceptFriendRequest = async (token: string, userId: number): Promise<void> => {
  const response = await fetch(`${apiBaseUrl}/friends/requests/${userId}/accept`, {
    method: 'POST',
    headers: authHeaders(token),
  });

  await parseResponse(response);
};

export const rejectFriendRequest = async (token: string, userId: number): Promise<void> => {
  const response = await fetch(`${apiBaseUrl}/friends/requests/${userId}/reject`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  await parseResponse(response);
};

export const removeFriend = async (token: string, userId: number): Promise<void> => {
  const response = await fetch(`${apiBaseUrl}/friends/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  await parseResponse(response);
};
