import type { CallKind, CallProvider } from './calls.service';

export const CALL_MEDIA_PROVIDER = Symbol('CALL_MEDIA_PROVIDER');

export interface EnsureCallRoomInput {
    callId: number;
    conversationId: number;
    kind: CallKind;
    roomName: string;
}

export interface CreateParticipantTokenInput {
    roomName: string;
    identity: string;
    name: string;
    ttlSeconds: number;
}

export interface ParticipantTokenResult {
    token: string;
    expiresAt: string;
}

export interface CallMediaClientConfig {
    provider: Extract<CallProvider, 'livekit'>;
    wsUrl: string;
    connectOptions: { autoSubscribe: false };
    roomOptions: { adaptiveStream: true; dynacast: true };
    videoPageSize: number;
}

export interface CallMediaProvider {
    readonly provider: Extract<CallProvider, 'livekit'>;
    getClientConfig(): CallMediaClientConfig;
    ensureRoom(input: EnsureCallRoomInput): Promise<void>;
    createParticipantToken(input: CreateParticipantTokenInput): Promise<ParticipantTokenResult>;
    removeParticipant(roomName: string, participantIdentity: string): Promise<void>;
    deleteRoom(roomName: string): Promise<void>;
}
