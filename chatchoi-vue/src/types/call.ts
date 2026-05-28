export type CallKind = 'audio' | 'video';
export type CallSessionStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'cancelled';
export type CallParticipantStatus = 'ringing' | 'joined' | 'left' | 'declined' | 'missed';
export type CallProvider = 'stub';

export interface CallUserSummary {
  id: number;
  username: string;
  avatar: string | null;
}

export interface CallParticipant {
  userId: number;
  username: string;
  avatar: string | null;
  status: CallParticipantStatus;
  micEnabled: boolean;
  cameraEnabled: boolean;
  joinedAt: string | null;
  leftAt: string | null;
  declinedAt: string | null;
  lastHeartbeatAt: string | null;
}

export interface CallState {
  id: number;
  conversationId: number;
  kind: CallKind;
  status: CallSessionStatus;
  provider: CallProvider;
  roomName: string;
  startedBy: CallUserSummary;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  endedReason: string | null;
  ringExpiresAt: string | null;
  participants: CallParticipant[];
  activeParticipantCount: number;
  currentUserStatus: CallParticipantStatus | 'none';
}

export interface ActiveCallsPayload {
  calls: CallState[];
}

export interface CallErrorPayload {
  message: string;
}

export interface CallHistoryItem {
  id: number;
  conversationId: number;
  kind: CallKind;
  status: CallSessionStatus;
  startedByUserId: number;
  startedByUsername: string;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  endedReason: string | null;
}
