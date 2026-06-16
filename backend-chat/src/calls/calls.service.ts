import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DrizzleService } from '../database/drizzle.service';
import { callParticipants, callSessions, conversationMembers, conversations, users } from '../database/schema';
import { MessagesService } from '../messages/messages.service';
import { CallLockService } from './call-lock.service';

export type CallKind = 'audio' | 'video';
export type CallSessionStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'cancelled';
export type CallParticipantStatus = 'ringing' | 'joined' | 'left' | 'declined' | 'missed';
export type CallProvider = 'stub' | 'livekit';
export type CallParticipantMediaStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed';

export interface CallUserSummary {
    id: number;
    username: string;
    displayName: string | null;
    avatar: string | null;
}

export interface StoredCallParticipant {
    userId: number;
    username: string;
    displayName: string | null;
    avatar: string | null;
    status: CallParticipantStatus;
    micEnabled: boolean;
    cameraEnabled: boolean;
    screenShareEnabled: boolean;
    joinedAt: string | null;
    leftAt: string | null;
    declinedAt: string | null;
    lastHeartbeatAt: string | null;
    mediaStatus: CallParticipantMediaStatus;
    mediaConnectedAt: string | null;
    mediaDisconnectedAt: string | null;
    mediaFailureReason: string | null;
}

export interface StoredCallState {
    id: number;
    conversationId: number;
    isGroup: boolean;
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
    participants: StoredCallParticipant[];
}

export interface PublicCallState extends Omit<StoredCallState, 'isGroup'> {
    activeParticipantCount: number;
    currentUserStatus: CallParticipantStatus | 'none';
}

export interface CallMutationResult {
    callId: number;
    conversationId: number;
    memberIds: number[];
    ringingUserIds: number[];
    state: StoredCallState;
    ended: boolean;
}

export interface CallHistoryItem {
    id: number;
    conversationId: number;
    kind: CallKind;
    status: CallSessionStatus;
    startedByUserId: number;
    startedByUsername: string;
    startedByDisplayName: string | null;
    startedAt: Date;
    answeredAt: Date | null;
    endedAt: Date | null;
    endedReason: string | null;
}

export interface CallMediaTokenContext {
    callId: number;
    conversationId: number;
    provider: CallProvider;
    roomName: string;
    kind: CallKind;
    user: CallUserSummary;
}

interface ConversationMemberForCall {
    userId: number;
    username: string;
    displayName: string | null;
    avatar: string | null;
}

interface ConversationAccess {
    conversationId: number;
    isGroup: boolean;
}

const RINGING_TTL_MS = 60_000;
const PARTICIPANT_HEARTBEAT_TIMEOUT_MS = 45_000;
const ACTIVE_CALL_TTL_SECONDS = 24 * 60 * 60;
const ENDED_CALL_TTL_SECONDS = 120;
const DEFAULT_CALL_PROVIDER: CallProvider = 'livekit';

@Injectable()
export class CallsService {
    private readonly redis: Redis;

    constructor(
        private readonly drizzle: DrizzleService,
        private readonly redisService: RedisService,
        private readonly messagesService: MessagesService,
        private readonly eventEmitter: EventEmitter2,
        private readonly callLockService: CallLockService,
    ) {
        this.redis = this.redisService.getOrThrow();
    }

    async startCall(userId: number, username: string, input: { conversationId: number; kind: CallKind }, displayName: string | null = null): Promise<CallMutationResult> {
        const kind = this.normalizeKind(input.kind);
        const access = await this.ensureConversationMember(userId, input.conversationId);

        return this.callLockService.withConversationCreateLock(input.conversationId, async () => {
            const joinedCallId = await this.redis.get(this.userJoinedKey(userId));
            if (joinedCallId) throw new BadRequestException('Bạn đang ở trong một cuộc gọi khác.');

            const activeCallId = await this.redis.get(this.activeConversationKey(input.conversationId));
            if (activeCallId) throw new BadRequestException('Đoạn chat này đang có cuộc gọi.');

            const existingActiveCall = await this.findActiveCallInDatabase(input.conversationId);
            if (existingActiveCall) {
                const restoredState = await this.buildStateFromDatabase(existingActiveCall.id);
                if (restoredState) await this.saveInitialActiveState(restoredState);
                throw new BadRequestException('Đoạn chat này đang có cuộc gọi.');
            }

            const members = await this.getConversationMembers(input.conversationId);
            if (members.length < 2) throw new BadRequestException('Cần ít nhất 2 thành viên để gọi.');

            const now = new Date();
            const roomName = `${DEFAULT_CALL_PROVIDER}_conv_${input.conversationId}_${now.getTime()}`;
            const ringExpiresAt = new Date(now.getTime() + RINGING_TTL_MS);

            const callId = await this.drizzle.db.transaction(async (tx) => {
                const [newCall] = await tx.insert(callSessions).values({
                    conversationId: input.conversationId,
                    startedByUserId: userId,
                    kind,
                    status: 'ringing',
                    provider: DEFAULT_CALL_PROVIDER,
                    roomName,
                    startedAt: now,
                });

                await tx.insert(callParticipants).values(members.map((member) => ({
                    callSessionId: newCall.insertId,
                    userId: member.userId,
                    status: member.userId === userId ? 'joined' : 'ringing',
                    micEnabled: member.userId === userId,
                    cameraEnabled: member.userId === userId && kind === 'video',
                    screenShareEnabled: false,
                    joinedAt: member.userId === userId ? now : null,
                    lastHeartbeatAt: member.userId === userId ? now : null,
                    mediaStatus: 'idle',
                })));

                return newCall.insertId;
            });

            const state: StoredCallState = {
                id: callId,
                conversationId: input.conversationId,
                isGroup: access.isGroup,
                kind,
                status: 'ringing',
                provider: DEFAULT_CALL_PROVIDER,
                roomName,
                startedBy: {
                    id: userId,
                    username,
                    displayName,
                    avatar: members.find((member) => member.userId === userId)?.avatar ?? null,
                },
                startedAt: this.toIso(now),
                answeredAt: null,
                endedAt: null,
                endedReason: null,
                ringExpiresAt: this.toIso(ringExpiresAt),
                participants: members.map((member) => ({
                    userId: member.userId,
                    username: member.username,
                    displayName: member.displayName,
                    avatar: member.avatar,
                    status: member.userId === userId ? 'joined' : 'ringing',
                    micEnabled: member.userId === userId,
                    cameraEnabled: member.userId === userId && kind === 'video',
                    screenShareEnabled: false,
                    joinedAt: member.userId === userId ? this.toIso(now) : null,
                    leftAt: null,
                    declinedAt: null,
                    lastHeartbeatAt: member.userId === userId ? this.toIso(now) : null,
                    mediaStatus: 'idle',
                    mediaConnectedAt: null,
                    mediaDisconnectedAt: null,
                    mediaFailureReason: null,
                })),
            };

            await this.saveInitialActiveState(state);

            const result = this.toMutationResult(state);
            this.eventEmitter.emit('call.started', result);
            return result;
        });
    }

    async acceptCall(userId: number, callId: number): Promise<CallMutationResult> {
        return this.joinCall(userId, callId);
    }

    async joinCall(userId: number, callId: number): Promise<CallMutationResult> {
        return this.callLockService.withCallLock(callId, async () => this.joinCallLocked(userId, callId));
    }

    private async joinCallLocked(userId: number, callId: number): Promise<CallMutationResult> {
        const state = await this.getAccessibleState(userId, callId);
        this.ensureCallIsJoinable(state);

        const currentJoinedCallId = await this.redis.get(this.userJoinedKey(userId));
        if (currentJoinedCallId && Number(currentJoinedCallId) !== callId) {
            throw new BadRequestException('Bạn đang ở trong một cuộc gọi khác.');
        }

        const participant = this.findParticipant(state, userId);
        if (!participant) throw new ForbiddenException('Bạn không có quyền tham gia cuộc gọi này.');
        if (participant.status === 'missed') {
            throw new BadRequestException('Bạn không thể tham gia lại cuộc gọi này.');
        }

        const now = new Date();
        const nextStatus: CallSessionStatus = state.status === 'ringing' ? 'active' : state.status;
        const answeredAt = state.answeredAt ?? this.toIso(now);
        const nextState = this.mapParticipant(state, userId, {
            status: 'joined',
            micEnabled: true,
            cameraEnabled: state.kind === 'video',
            screenShareEnabled: false,
            joinedAt: participant.joinedAt ?? this.toIso(now),
            leftAt: null,
            declinedAt: null,
            lastHeartbeatAt: this.toIso(now),
            mediaStatus: 'idle',
            mediaConnectedAt: null,
            mediaDisconnectedAt: null,
            mediaFailureReason: null,
        });

        nextState.status = nextStatus;
        nextState.answeredAt = answeredAt;
        nextState.ringExpiresAt = null;

        await this.drizzle.db.transaction(async (tx) => {
            await tx.update(callParticipants)
                .set({
                    status: 'joined',
                    micEnabled: true,
                    cameraEnabled: state.kind === 'video',
                    screenShareEnabled: false,
                    joinedAt: participant.joinedAt ? new Date(participant.joinedAt) : now,
                    leftAt: null,
                    declinedAt: null,
                    lastHeartbeatAt: now,
                    mediaStatus: 'idle',
                    mediaConnectedAt: null,
                    mediaDisconnectedAt: null,
                    mediaFailureReason: null,
                })
                .where(and(eq(callParticipants.callSessionId, callId), eq(callParticipants.userId, userId)));

            if (state.status === 'ringing') {
                await tx.update(callSessions)
                    .set({ status: 'active', answeredAt: now })
                    .where(eq(callSessions.id, callId));
            }
        });

        await this.saveActiveState(nextState);
        await this.markUserJoined(userId, callId);
        const result = this.toMutationResult(nextState);
        this.eventEmitter.emit('call.state_changed', result);
        return result;
    }

    async declineCall(userId: number, callId: number): Promise<CallMutationResult> {
        return this.callLockService.withCallLock(callId, async () => this.declineCallLocked(userId, callId));
    }

    private async declineCallLocked(userId: number, callId: number): Promise<CallMutationResult> {
        const state = await this.getAccessibleState(userId, callId);
        this.ensureCallIsActiveOrRinging(state);

        const participant = this.findParticipant(state, userId);
        if (!participant) throw new ForbiddenException('Bạn không có quyền từ chối cuộc gọi này.');
        if (participant.status === 'joined') return this.leaveCallLocked(userId, callId, state);
        if (participant.status === 'declined' || participant.status === 'missed') return this.toMutationResult(state);

        const now = new Date();
        const nextState = this.mapParticipant(state, userId, {
            status: 'declined',
            micEnabled: false,
            cameraEnabled: false,
            screenShareEnabled: false,
            declinedAt: this.toIso(now),
            mediaStatus: 'idle',
            mediaFailureReason: null,
        });

        await this.drizzle.db.update(callParticipants)
            .set({
                status: 'declined',
                micEnabled: false,
                cameraEnabled: false,
                screenShareEnabled: false,
                declinedAt: now,
                mediaStatus: 'idle',
                mediaFailureReason: null,
            })
            .where(and(eq(callParticipants.callSessionId, callId), eq(callParticipants.userId, userId)));

        const shouldEndRingingCall = state.status === 'ringing'
            && this.getRingingParticipants(nextState).length === 0
            && this.getJoinedParticipants(nextState).length <= 1;
        const shouldEndDirectCall = !state.isGroup;

        if (shouldEndDirectCall || shouldEndRingingCall) {
            return this.endCall(nextState, 'ended', 'declined');
        }

        await this.saveActiveState(nextState);
        await this.clearUserJoined(userId);
        const result = this.toMutationResult(nextState);
        this.eventEmitter.emit('call.state_changed', result);
        return result;
    }

    async leaveCall(userId: number, callId: number): Promise<CallMutationResult> {
        return this.callLockService.withCallLock(callId, async () => this.leaveCallLocked(userId, callId));
    }

    private async leaveCallLocked(userId: number, callId: number, currentState?: StoredCallState): Promise<CallMutationResult> {
        const state = currentState ?? await this.getAccessibleState(userId, callId);
        this.ensureCallIsActiveOrRinging(state);

        const participant = this.findParticipant(state, userId);
        if (!participant) throw new ForbiddenException('Bạn không có quyền rời cuộc gọi này.');

        if (state.status === 'ringing' && state.startedBy.id === userId) {
            return this.endCall(state, 'cancelled', 'cancelled');
        }

        const now = new Date();
        const nextState = this.mapParticipant(state, userId, {
            status: participant.status === 'joined' ? 'left' : 'declined',
            micEnabled: false,
            cameraEnabled: false,
            screenShareEnabled: false,
            leftAt: participant.status === 'joined' ? this.toIso(now) : participant.leftAt,
            declinedAt: participant.status === 'joined' ? participant.declinedAt : this.toIso(now),
            mediaStatus: participant.status === 'joined' ? 'disconnected' : 'idle',
            mediaDisconnectedAt: participant.status === 'joined' ? this.toIso(now) : participant.mediaDisconnectedAt,
            mediaFailureReason: null,
        });

        await this.drizzle.db.update(callParticipants)
            .set({
                status: participant.status === 'joined' ? 'left' : 'declined',
                micEnabled: false,
                cameraEnabled: false,
                screenShareEnabled: false,
                leftAt: participant.status === 'joined' ? now : participant.leftAt ? new Date(participant.leftAt) : null,
                declinedAt: participant.status === 'joined' ? participant.declinedAt ? new Date(participant.declinedAt) : null : now,
                mediaStatus: participant.status === 'joined' ? 'disconnected' : 'idle',
                mediaDisconnectedAt: participant.status === 'joined' ? now : participant.mediaDisconnectedAt ? new Date(participant.mediaDisconnectedAt) : null,
                mediaFailureReason: null,
            })
            .where(and(eq(callParticipants.callSessionId, callId), eq(callParticipants.userId, userId)));

        await this.clearUserJoined(userId);

        const joinedCount = this.getJoinedParticipants(nextState).length;
        if (!state.isGroup || joinedCount === 0) {
            return this.endCall(nextState, 'ended', 'left');
        }

        await this.saveActiveState(nextState);
        const result = this.toMutationResult(nextState);
        if (participant.status === 'joined') {
            this.eventEmitter.emit('call.participant_left', {
                callId,
                conversationId: state.conversationId,
                provider: state.provider,
                roomName: state.roomName,
                userId,
            });
        }
        this.eventEmitter.emit('call.state_changed', result);
        return result;
    }

    async updateMediaState(userId: number, callId: number, input: { micEnabled: boolean; cameraEnabled: boolean; screenShareEnabled?: boolean }): Promise<CallMutationResult> {
        return this.callLockService.withCallLock(callId, async () => this.updateMediaStateLocked(userId, callId, input));
    }

    private async updateMediaStateLocked(userId: number, callId: number, input: { micEnabled: boolean; cameraEnabled: boolean; screenShareEnabled?: boolean }): Promise<CallMutationResult> {
        const state = await this.getAccessibleState(userId, callId);
        this.ensureCallIsActiveOrRinging(state);

        const participant = this.findParticipant(state, userId);
        if (!participant || participant.status !== 'joined') {
            throw new BadRequestException('Bạn cần tham gia cuộc gọi trước khi cập nhật thiết bị.');
        }

        // screenShareEnabled là optional để các client cũ chỉ gửi mic/camera không vô tình tắt chia sẻ màn hình.
        const nextScreenShareEnabled = input.screenShareEnabled === undefined
            ? participant.screenShareEnabled
            : Boolean(input.screenShareEnabled);

        const nextState = this.mapParticipant(state, userId, {
            micEnabled: Boolean(input.micEnabled),
            cameraEnabled: Boolean(input.cameraEnabled),
            screenShareEnabled: nextScreenShareEnabled,
        });

        await this.drizzle.db.update(callParticipants)
            .set({
                micEnabled: Boolean(input.micEnabled),
                cameraEnabled: Boolean(input.cameraEnabled),
                screenShareEnabled: nextScreenShareEnabled,
            })
            .where(and(eq(callParticipants.callSessionId, callId), eq(callParticipants.userId, userId)));

        await this.saveActiveState(nextState);
        const result = this.toMutationResult(nextState);
        this.eventEmitter.emit('call.state_changed', result);
        return result;
    }

    async heartbeat(userId: number, callId: number): Promise<CallMutationResult> {
        return this.callLockService.withCallLock(callId, async () => this.heartbeatLocked(userId, callId));
    }

    private async heartbeatLocked(userId: number, callId: number): Promise<CallMutationResult> {
        const state = await this.getAccessibleState(userId, callId);
        this.ensureCallIsActiveOrRinging(state);

        const participant = this.findParticipant(state, userId);
        if (!participant || participant.status !== 'joined') {
            throw new BadRequestException('Bạn chưa tham gia cuộc gọi này.');
        }

        const now = new Date();
        const nextState = this.mapParticipant(state, userId, {
            lastHeartbeatAt: this.toIso(now),
        });

        await this.drizzle.db.update(callParticipants)
            .set({ lastHeartbeatAt: now })
            .where(and(eq(callParticipants.callSessionId, callId), eq(callParticipants.userId, userId)));

        await this.saveCallState(nextState);
        await this.saveParticipantState(callId, this.findParticipant(nextState, userId)!);
        await this.markUserJoined(userId, callId);
        return this.toMutationResult(nextState);
    }

    async updateMediaConnectionStatus(
        userId: number,
        callId: number,
        input: { status: CallParticipantMediaStatus; failureReason?: string | null },
    ): Promise<CallMutationResult> {
        return this.callLockService.withCallLock(callId, async () => {
            const state = await this.getAccessibleState(userId, callId);
            this.ensureCallIsActiveOrRinging(state);

            const participant = this.findParticipant(state, userId);
            if (!participant || participant.status !== 'joined') {
                throw new BadRequestException('Bạn cần tham gia cuộc gọi trước khi cập nhật kết nối media.');
            }

            const now = new Date();
            const status = this.normalizeMediaStatus(input.status);
            const isConnected = status === 'connected';
            const isDisconnected = status === 'disconnected' || status === 'failed';
            const failureReason = status === 'failed'
                ? this.normalizeMediaFailureReason(input.failureReason)
                : null;
            const nextMediaConnectedAt = isConnected ? participant.mediaConnectedAt ?? this.toIso(now) : participant.mediaConnectedAt;
            const nextMediaDisconnectedAt = isDisconnected ? this.toIso(now) : participant.mediaDisconnectedAt;
            const mediaConnectedAt = nextMediaConnectedAt ? new Date(nextMediaConnectedAt) : null;
            const mediaDisconnectedAt = nextMediaDisconnectedAt ? new Date(nextMediaDisconnectedAt) : null;

            const nextState = this.mapParticipant(state, userId, {
                mediaStatus: status,
                mediaConnectedAt: nextMediaConnectedAt,
                mediaDisconnectedAt: nextMediaDisconnectedAt,
                mediaFailureReason: failureReason,
            });

            await this.drizzle.db.update(callParticipants)
                .set({
                    mediaStatus: status,
                    mediaConnectedAt,
                    mediaDisconnectedAt,
                    mediaFailureReason: failureReason,
                })
                .where(and(eq(callParticipants.callSessionId, callId), eq(callParticipants.userId, userId)));

            await this.saveActiveState(nextState);
            const result = this.toMutationResult(nextState);
            this.eventEmitter.emit('call.state_changed', result);
            return result;
        });
    }

    async getActiveCallsForUser(userId: number): Promise<PublicCallState[]> {
        const conversationIds = await this.getUserConversationIds(userId);
        const states = await Promise.all(conversationIds.map(async (conversationId) => {
            return this.getActiveStateForConversation(conversationId);
        }));

        return states
            .filter((state): state is StoredCallState => Boolean(state))
            .map((state) => this.toPublicState(state, userId));
    }

    async getActiveCallForConversation(userId: number, conversationId: number): Promise<PublicCallState | null> {
        await this.ensureConversationMember(userId, conversationId);
        const state = await this.getActiveStateForConversation(conversationId);
        return state ? this.toPublicState(state, userId) : null;
    }

    async getPublicCallState(callId: number, userId: number): Promise<PublicCallState> {
        const state = await this.getAccessibleState(userId, callId);
        return this.toPublicState(state, userId);
    }

    async getMediaTokenContext(userId: number, callId: number): Promise<CallMediaTokenContext> {
        const state = await this.getAccessibleState(userId, callId);
        this.ensureCallIsJoinable(state);

        const participant = this.findParticipant(state, userId);
        if (!participant || participant.status !== 'joined') {
            throw new BadRequestException('Bạn cần tham gia cuộc gọi trước khi kết nối media.');
        }

        if (state.provider !== 'livekit') {
            throw new BadRequestException('Cuộc gọi này chưa hỗ trợ media streaming.');
        }

        return {
            callId: state.id,
            conversationId: state.conversationId,
            provider: state.provider,
            roomName: state.roomName,
            kind: state.kind,
            user: {
                id: participant.userId,
                username: participant.username,
                displayName: participant.displayName,
                avatar: participant.avatar,
            },
        };
    }

    async getCallHistory(userId: number, input: { conversationId?: number; limit?: number; beforeId?: number }): Promise<CallHistoryItem[]> {
        const limit = this.normalizeHistoryLimit(input.limit);

        if (input.conversationId) {
            await this.ensureConversationMember(userId, input.conversationId);
        }

        const conversationIds = input.conversationId ? [input.conversationId] : await this.getUserConversationIds(userId);
        if (conversationIds.length === 0) return [];

        const where = input.beforeId && input.beforeId > 0
            ? and(
                inArray(callSessions.conversationId, conversationIds),
                inArray(callSessions.status, ['ended', 'missed', 'cancelled']),
                lt(callSessions.id, input.beforeId),
            )
            : and(
                inArray(callSessions.conversationId, conversationIds),
                inArray(callSessions.status, ['ended', 'missed', 'cancelled']),
            );

        const rows = await this.drizzle.db
            .select({
                id: callSessions.id,
                conversationId: callSessions.conversationId,
                kind: callSessions.kind,
                status: callSessions.status,
                startedByUserId: callSessions.startedByUserId,
                startedByUsername: users.username,
                startedByDisplayName: users.displayName,
                startedAt: callSessions.startedAt,
                answeredAt: callSessions.answeredAt,
                endedAt: callSessions.endedAt,
                endedReason: callSessions.endedReason,
            })
            .from(callSessions)
            .innerJoin(users, eq(callSessions.startedByUserId, users.id))
            .where(where)
            .orderBy(desc(callSessions.id))
            .limit(limit);

        return rows.map((row) => ({
            id: row.id,
            conversationId: row.conversationId,
            kind: this.normalizeKind(row.kind),
            status: this.normalizeSessionStatus(row.status),
            startedByUserId: row.startedByUserId,
            startedByUsername: row.startedByUsername,
            startedByDisplayName: row.startedByDisplayName,
            startedAt: row.startedAt,
            answeredAt: row.answeredAt,
            endedAt: row.endedAt,
            endedReason: row.endedReason,
        }));
    }

    @Cron(CronExpression.EVERY_10_SECONDS)
    async cleanupExpiredCalls() {
        const callIds = await this.redis.smembers(this.activeCallsKey());
        await Promise.all(callIds.map(async (callIdValue) => {
            const callId = Number(callIdValue);
            if (!Number.isInteger(callId) || callId <= 0) return;

            try {
                await this.callLockService.withCallLock(callId, async () => {
                    const state = await this.getStoredState(callId);
                    if (!state) {
                        await this.redis.srem(this.activeCallsKey(), callIdValue);
                        return;
                    }

                    if (state.status === 'ringing' && state.ringExpiresAt && new Date(state.ringExpiresAt).getTime() <= Date.now()) {
                        await this.endCall(state, 'missed', 'timeout');
                        return;
                    }

                    if (state.status === 'active') {
                        await this.markStaleParticipantsLeft(state);
                    }
                });
            } catch (error) {
                if (!(error instanceof ConflictException)) throw error;
            }
        }));
    }

    private async markStaleParticipantsLeft(state: StoredCallState) {
        const now = new Date();
        const staleParticipants = state.participants.filter((participant) => {
            if (participant.status !== 'joined') return false;
            if (!participant.lastHeartbeatAt) return false;
            return now.getTime() - new Date(participant.lastHeartbeatAt).getTime() > PARTICIPANT_HEARTBEAT_TIMEOUT_MS;
        });

        if (staleParticipants.length === 0) return;

        let nextState = state;
        for (const participant of staleParticipants) {
            nextState = this.mapParticipant(nextState, participant.userId, {
                status: 'left',
                micEnabled: false,
                cameraEnabled: false,
                screenShareEnabled: false,
                leftAt: this.toIso(now),
                mediaStatus: 'disconnected',
                mediaDisconnectedAt: this.toIso(now),
                mediaFailureReason: null,
            });
            await this.clearUserJoined(participant.userId);
        }

        await this.drizzle.db.update(callParticipants)
            .set({
                status: 'left',
                micEnabled: false,
                cameraEnabled: false,
                screenShareEnabled: false,
                leftAt: now,
                mediaStatus: 'disconnected',
                mediaDisconnectedAt: now,
                mediaFailureReason: null,
            })
            .where(and(
                eq(callParticipants.callSessionId, state.id),
                inArray(callParticipants.userId, staleParticipants.map((participant) => participant.userId)),
            ));

        if (this.getJoinedParticipants(nextState).length === 0 || !nextState.isGroup) {
            await this.endCall(nextState, 'ended', 'connection_lost');
            return;
        }

        await this.saveActiveState(nextState);
        for (const participant of staleParticipants) {
            this.eventEmitter.emit('call.participant_left', {
                callId: state.id,
                conversationId: state.conversationId,
                provider: state.provider,
                roomName: state.roomName,
                userId: participant.userId,
            });
        }
        this.eventEmitter.emit('call.state_changed', this.toMutationResult(nextState));
    }

    private async endCall(state: StoredCallState, finalStatus: CallSessionStatus, reason: string): Promise<CallMutationResult> {
        if (['ended', 'missed', 'cancelled'].includes(state.status)) return this.toMutationResult(state);

        const now = new Date();
        const nextParticipants = state.participants.map((participant) => {
            if (participant.status === 'joined') {
                return {
                    ...participant,
                    status: 'left' as const,
                    micEnabled: false,
                    cameraEnabled: false,
                    screenShareEnabled: false,
                    leftAt: participant.leftAt ?? this.toIso(now),
                    mediaStatus: 'disconnected' as const,
                    mediaDisconnectedAt: participant.mediaDisconnectedAt ?? this.toIso(now),
                    mediaFailureReason: null,
                };
            }

            if (participant.status === 'ringing') {
                return {
                    ...participant,
                    status: 'missed' as const,
                    micEnabled: false,
                    cameraEnabled: false,
                    screenShareEnabled: false,
                    mediaStatus: 'idle' as const,
                    mediaFailureReason: null,
                };
            }

            return {
                ...participant,
                micEnabled: false,
                cameraEnabled: false,
                screenShareEnabled: false,
                mediaStatus: participant.status === 'declined' ? 'idle' as const : participant.mediaStatus,
                mediaFailureReason: null,
            };
        });

        const nextState: StoredCallState = {
            ...state,
            status: finalStatus,
            endedAt: this.toIso(now),
            endedReason: reason,
            ringExpiresAt: null,
            participants: nextParticipants,
        };

        await this.drizzle.db.transaction(async (tx) => {
            await tx.update(callSessions)
                .set({
                    status: finalStatus,
                    endedAt: now,
                    endedReason: reason,
                })
                .where(eq(callSessions.id, state.id));

            await tx.update(callParticipants)
                .set({
                    status: 'left',
                    micEnabled: false,
                    cameraEnabled: false,
                    screenShareEnabled: false,
                    leftAt: now,
                    mediaStatus: 'disconnected',
                    mediaDisconnectedAt: now,
                    mediaFailureReason: null,
                })
                .where(and(eq(callParticipants.callSessionId, state.id), eq(callParticipants.status, 'joined')));

            await tx.update(callParticipants)
                .set({
                    status: 'missed',
                    micEnabled: false,
                    cameraEnabled: false,
                    screenShareEnabled: false,
                    mediaStatus: 'idle',
                    mediaFailureReason: null,
                })
                .where(and(eq(callParticipants.callSessionId, state.id), eq(callParticipants.status, 'ringing')));
        });

        await this.saveEndedState(nextState);
        await this.createCallEventMessage(nextState);
        const result = this.toMutationResult(nextState);
        this.eventEmitter.emit('call.ended', result);
        return result;
    }

    private async createCallEventMessage(state: StoredCallState) {
        const content = this.getCallEventContent(state);
        if (!content) return;

        await this.messagesService.createCallEventMessage({
            conversationId: state.conversationId,
            senderId: state.startedBy.id,
            callSessionId: state.id,
            content,
        });
    }

    private getCallEventContent(state: StoredCallState) {
        const kindLabel = state.kind === 'video' ? 'video' : 'thoại';
        if (state.status === 'cancelled') return `Cuộc gọi ${kindLabel} đã bị huỷ`;
        if (state.status === 'missed') return `Cuộc gọi ${kindLabel} bị nhỡ`;
        return `Cuộc gọi ${kindLabel} đã kết thúc`;
    }

    private async getAccessibleState(userId: number, callId: number): Promise<StoredCallState> {
        const state = await this.getStoredState(callId);
        if (!state) throw new NotFoundException('Không tìm thấy cuộc gọi.');
        await this.ensureConversationMember(userId, state.conversationId);
        return state;
    }

    private async getActiveStateForConversation(conversationId: number): Promise<StoredCallState | null> {
        const activeCallId = await this.redis.get(this.activeConversationKey(conversationId));
        if (!activeCallId) return null;

        const state = await this.getStoredState(Number(activeCallId));
        if (state && state.conversationId === conversationId && ['ringing', 'active'].includes(state.status)) return state;

        await this.redis.del(this.activeConversationKey(conversationId));
        return null;
    }

    private async getStoredState(callId: number): Promise<StoredCallState | null> {
        const raw = await this.redis.get(this.callStateKey(callId));
        if (raw) {
            try {
                return JSON.parse(raw) as StoredCallState;
            } catch {
                await this.redis.del(this.callStateKey(callId));
            }
        }

        const state = await this.buildStateFromDatabase(callId);
        if (!state) return null;
        if (['ringing', 'active'].includes(state.status)) await this.saveInitialActiveState(state);
        return state;
    }

    private async buildStateFromDatabase(callId: number): Promise<StoredCallState | null> {
        const [call] = await this.drizzle.db
            .select({
                id: callSessions.id,
                conversationId: callSessions.conversationId,
                isGroup: conversations.isGroup,
                kind: callSessions.kind,
                status: callSessions.status,
                provider: callSessions.provider,
                roomName: callSessions.roomName,
                startedByUserId: callSessions.startedByUserId,
                startedByUsername: users.username,
                startedByDisplayName: users.displayName,
                startedByAvatar: users.avatar,
                startedAt: callSessions.startedAt,
                answeredAt: callSessions.answeredAt,
                endedAt: callSessions.endedAt,
                endedReason: callSessions.endedReason,
            })
            .from(callSessions)
            .innerJoin(conversations, eq(callSessions.conversationId, conversations.id))
            .innerJoin(users, eq(callSessions.startedByUserId, users.id))
            .where(eq(callSessions.id, callId))
            .limit(1);

        if (!call) return null;

        const participants = await this.drizzle.db
            .select({
                userId: callParticipants.userId,
                username: users.username,
                displayName: users.displayName,
                avatar: users.avatar,
                status: callParticipants.status,
                micEnabled: callParticipants.micEnabled,
                cameraEnabled: callParticipants.cameraEnabled,
                screenShareEnabled: callParticipants.screenShareEnabled,
                joinedAt: callParticipants.joinedAt,
                leftAt: callParticipants.leftAt,
                declinedAt: callParticipants.declinedAt,
                lastHeartbeatAt: callParticipants.lastHeartbeatAt,
                mediaStatus: callParticipants.mediaStatus,
                mediaConnectedAt: callParticipants.mediaConnectedAt,
                mediaDisconnectedAt: callParticipants.mediaDisconnectedAt,
                mediaFailureReason: callParticipants.mediaFailureReason,
            })
            .from(callParticipants)
            .innerJoin(users, eq(callParticipants.userId, users.id))
            .where(eq(callParticipants.callSessionId, callId));

        return {
            id: call.id,
            conversationId: call.conversationId,
            isGroup: call.isGroup,
            kind: this.normalizeKind(call.kind),
            status: this.normalizeSessionStatus(call.status),
            provider: this.normalizeProvider(call.provider),
            roomName: call.roomName,
            startedBy: {
                id: call.startedByUserId,
                username: call.startedByUsername,
                displayName: call.startedByDisplayName,
                avatar: call.startedByAvatar,
            },
            startedAt: this.toIso(call.startedAt),
            answeredAt: this.toIsoOrNull(call.answeredAt),
            endedAt: this.toIsoOrNull(call.endedAt),
            endedReason: call.endedReason,
            ringExpiresAt: call.status === 'ringing'
                ? this.toIso(new Date(call.startedAt.getTime() + RINGING_TTL_MS))
                : null,
            participants: participants.map((participant) => ({
                userId: participant.userId,
                username: participant.username,
                displayName: participant.displayName,
                avatar: participant.avatar,
                status: this.normalizeParticipantStatus(participant.status),
                micEnabled: Boolean(participant.micEnabled),
                cameraEnabled: Boolean(participant.cameraEnabled),
                screenShareEnabled: Boolean(participant.screenShareEnabled),
                joinedAt: this.toIsoOrNull(participant.joinedAt),
                leftAt: this.toIsoOrNull(participant.leftAt),
                declinedAt: this.toIsoOrNull(participant.declinedAt),
                lastHeartbeatAt: this.toIsoOrNull(participant.lastHeartbeatAt),
                mediaStatus: this.normalizeMediaStatus(participant.mediaStatus),
                mediaConnectedAt: this.toIsoOrNull(participant.mediaConnectedAt),
                mediaDisconnectedAt: this.toIsoOrNull(participant.mediaDisconnectedAt),
                mediaFailureReason: participant.mediaFailureReason,
            })),
        };
    }

    private async saveInitialActiveState(state: StoredCallState) {
        await this.saveActiveState(state);
    }

    private async saveActiveState(state: StoredCallState) {
        const pipeline = this.redis.multi();
        pipeline.set(this.callStateKey(state.id), JSON.stringify(state), 'EX', ACTIVE_CALL_TTL_SECONDS);
        pipeline.set(this.activeConversationKey(state.conversationId), String(state.id), 'EX', ACTIVE_CALL_TTL_SECONDS);
        pipeline.sadd(this.activeCallsKey(), String(state.id));

        for (const participant of state.participants) {
            pipeline.sadd(this.callParticipantSetKey(state.id), String(participant.userId));
            pipeline.set(
                this.callParticipantKey(state.id, participant.userId),
                JSON.stringify(participant),
                'EX',
                ACTIVE_CALL_TTL_SECONDS,
            );

            if (participant.status === 'joined') {
                pipeline.set(this.userJoinedKey(participant.userId), String(state.id), 'EX', ACTIVE_CALL_TTL_SECONDS);
            }
        }

        await pipeline.exec();
    }

    private async saveCallState(state: StoredCallState) {
        const pipeline = this.redis.multi();
        pipeline.set(this.callStateKey(state.id), JSON.stringify(state), 'EX', ACTIVE_CALL_TTL_SECONDS);
        pipeline.set(this.activeConversationKey(state.conversationId), String(state.id), 'EX', ACTIVE_CALL_TTL_SECONDS);
        pipeline.sadd(this.activeCallsKey(), String(state.id));
        await pipeline.exec();
    }

    private async saveParticipantState(callId: number, participant: StoredCallParticipant) {
        const pipeline = this.redis.multi();
        pipeline.sadd(this.callParticipantSetKey(callId), String(participant.userId));
        pipeline.set(
            this.callParticipantKey(callId, participant.userId),
            JSON.stringify(participant),
            'EX',
            ACTIVE_CALL_TTL_SECONDS,
        );
        await pipeline.exec();
    }

    private async markUserJoined(userId: number, callId: number) {
        await this.redis.set(this.userJoinedKey(userId), String(callId), 'EX', ACTIVE_CALL_TTL_SECONDS);
    }

    private async clearUserJoined(userId: number) {
        await this.redis.del(this.userJoinedKey(userId));
    }

    private async saveEndedState(state: StoredCallState) {
        const pipeline = this.redis.multi();
        pipeline.set(this.callStateKey(state.id), JSON.stringify(state), 'EX', ENDED_CALL_TTL_SECONDS);
        pipeline.del(this.activeConversationKey(state.conversationId));
        pipeline.srem(this.activeCallsKey(), String(state.id));
        pipeline.del(this.callParticipantSetKey(state.id));

        for (const participant of state.participants) {
            pipeline.del(this.callParticipantKey(state.id, participant.userId));
            pipeline.del(this.userJoinedKey(participant.userId));
        }

        await pipeline.exec();
    }

    private async ensureConversationMember(userId: number, conversationId: number): Promise<ConversationAccess> {
        const [member] = await this.drizzle.db
            .select({
                conversationId: conversationMembers.conversationId,
                isGroup: conversations.isGroup,
            })
            .from(conversationMembers)
            .innerJoin(conversations, eq(conversationMembers.conversationId, conversations.id))
            .where(and(
                eq(conversationMembers.userId, userId),
                eq(conversationMembers.conversationId, conversationId),
            ))
            .limit(1);

        if (!member) throw new ForbiddenException('Bạn không có quyền trong đoạn chat này.');
        return member;
    }

    private async getConversationMembers(conversationId: number): Promise<ConversationMemberForCall[]> {
        const rows = await this.drizzle.db
            .select({
                userId: conversationMembers.userId,
                username: users.username,
                displayName: users.displayName,
                avatar: users.avatar,
            })
            .from(conversationMembers)
            .innerJoin(users, eq(conversationMembers.userId, users.id))
            .where(eq(conversationMembers.conversationId, conversationId));

        return rows.map((row) => ({
            userId: row.userId,
            username: row.username,
            displayName: row.displayName,
            avatar: row.avatar,
        }));
    }

    private async getUserConversationIds(userId: number) {
        const rows = await this.drizzle.db
            .select({ conversationId: conversationMembers.conversationId })
            .from(conversationMembers)
            .where(eq(conversationMembers.userId, userId));

        return rows.map((row) => row.conversationId);
    }

    private async findActiveCallInDatabase(conversationId: number) {
        const [call] = await this.drizzle.db
            .select({ id: callSessions.id })
            .from(callSessions)
            .where(and(
                eq(callSessions.conversationId, conversationId),
                inArray(callSessions.status, ['ringing', 'active']),
            ))
            .limit(1);

        return call ?? null;
    }

    private toMutationResult(state: StoredCallState): CallMutationResult {
        return {
            callId: state.id,
            conversationId: state.conversationId,
            memberIds: state.participants.map((participant) => participant.userId),
            ringingUserIds: this.getRingingParticipants(state).map((participant) => participant.userId),
            state,
            ended: ['ended', 'missed', 'cancelled'].includes(state.status),
        };
    }

    private toPublicState(state: StoredCallState, userId: number): PublicCallState {
        const { isGroup: _isGroup, ...publicState } = state;
        const currentParticipant = state.participants.find((participant) => participant.userId === userId);

        return {
            ...publicState,
            activeParticipantCount: this.getJoinedParticipants(state).length,
            currentUserStatus: currentParticipant?.status ?? 'none',
        };
    }

    private mapParticipant(
        state: StoredCallState,
        userId: number,
        patch: Partial<StoredCallParticipant>,
    ): StoredCallState {
        return {
            ...state,
            participants: state.participants.map((participant) => {
                return participant.userId === userId
                    ? { ...participant, ...patch }
                    : participant;
            }),
        };
    }

    private findParticipant(state: StoredCallState, userId: number) {
        return state.participants.find((participant) => participant.userId === userId);
    }

    private getJoinedParticipants(state: StoredCallState) {
        return state.participants.filter((participant) => participant.status === 'joined');
    }

    private getRingingParticipants(state: StoredCallState) {
        return state.participants.filter((participant) => participant.status === 'ringing');
    }

    private ensureCallIsJoinable(state: StoredCallState) {
        if (!['ringing', 'active'].includes(state.status)) {
            throw new BadRequestException('Cuộc gọi đã kết thúc.');
        }
    }

    private ensureCallIsActiveOrRinging(state: StoredCallState) {
        if (!['ringing', 'active'].includes(state.status)) {
            throw new BadRequestException('Cuộc gọi đã kết thúc.');
        }
    }

    private normalizeKind(value: string): CallKind {
        if (value === 'audio' || value === 'video') return value;
        throw new BadRequestException('Loại cuộc gọi không hợp lệ.');
    }

    private normalizeSessionStatus(value: string): CallSessionStatus {
        if (['ringing', 'active', 'ended', 'missed', 'cancelled'].includes(value)) {
            return value as CallSessionStatus;
        }
        return 'ended';
    }

    private normalizeProvider(value: string): CallProvider {
        if (value === 'livekit' || value === 'stub') return value;
        return 'stub';
    }

    private normalizeParticipantStatus(value: string): CallParticipantStatus {
        if (['ringing', 'joined', 'left', 'declined', 'missed'].includes(value)) {
            return value as CallParticipantStatus;
        }
        return 'left';
    }

    private normalizeMediaStatus(value: string): CallParticipantMediaStatus {
        if (['idle', 'connecting', 'connected', 'reconnecting', 'disconnected', 'failed'].includes(value)) {
            return value as CallParticipantMediaStatus;
        }

        return 'idle';
    }

    private normalizeMediaFailureReason(value: string | null | undefined) {
        if (!value) return null;
        return value.slice(0, 191);
    }

    private normalizeHistoryLimit(limit: number | undefined) {
        if (!limit || limit < 1) return 30;
        return Math.min(Math.floor(limit), 60);
    }

    private toIso(date: Date | string) {
        return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
    }

    private toIsoOrNull(date: Date | string | null) {
        return date ? this.toIso(date) : null;
    }

    private activeConversationKey(conversationId: number) {
        return `call:conversation:${conversationId}:active`;
    }

    private callStateKey(callId: number) {
        return `call:${callId}:state`;
    }

    private callParticipantSetKey(callId: number) {
        return `call:${callId}:participants`;
    }

    private callParticipantKey(callId: number, userId: number) {
        return `call:${callId}:participant:${userId}`;
    }

    private userJoinedKey(userId: number) {
        return `call:user:${userId}:joined`;
    }

    private activeCallsKey() {
        return 'calls:active';
    }

    private createLockKey(conversationId: number) {
        return `call:create-lock:conversation:${conversationId}`;
    }
}
