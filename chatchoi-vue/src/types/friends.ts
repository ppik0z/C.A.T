export type RelationshipStatus = 'none' | 'incoming_pending' | 'outgoing_pending' | 'friends';

export interface FriendUser {
  id: number;
  username: string;
  avatar: string | null;
  isOnline?: boolean;
  relationshipStatus?: RelationshipStatus;
  requestedAt?: string;
  directConversationId?: number | null;
}

export type FriendRequest = FriendUser;

export type FriendsTab = 'suggestions' | 'requests' | 'friends';
