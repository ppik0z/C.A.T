import {
    ConnectedSocket,
    MessageBody,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { ConflictException, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Server } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { CallsService, type CallKind, type CallMutationResult, type CallParticipantMediaStatus } from './calls.service';
import { HybridThrottlerGuard } from '../common/guards/hybrid-throttler.guard';
import { WsJwtGuard } from '../common/guards/ws-jwt.guard';
import type { AuthenticatedSocket } from '../common/interfaces/request-with-user.interface';

interface StartCallPayload {
    conversationId: number;
    kind: CallKind;
}

interface CallIdPayload {
    callId: number;
}

interface ConversationCallPayload {
    conversationId: number;
}

interface UpdateMediaPayload extends CallIdPayload {
    micEnabled: boolean;
    cameraEnabled: boolean;
}

interface UpdateMediaConnectionPayload extends CallIdPayload {
    failureReason?: string | null;
}

@UseGuards(WsJwtGuard, HybridThrottlerGuard)
@WebSocketGateway({ cors: { origin: '*' } })
export class CallsGateway {
    @WebSocketServer() server: Server;

    constructor(private readonly callsService: CallsService) { }

    @OnEvent('call.started')
    async handleCallStarted(result: CallMutationResult) {
        await this.emitCallMutation(result, true);
    }

    @OnEvent('call.state_changed')
    async handleCallStateChanged(result: CallMutationResult) {
        await this.emitCallMutation(result);
    }

    @OnEvent('call.ended')
    async handleCallEnded(result: CallMutationResult) {
        await this.emitPublicStateToUsers('call:ended', result.memberIds, result.callId);
    }

    @SubscribeMessage('call:start')
    async startCall(@MessageBody() data: StartCallPayload, @ConnectedSocket() client: AuthenticatedSocket) {
        try {
            await this.callsService.startCall(client.user.userId, client.user.username, data);
            return { status: 'ack' };
        } catch (error) {
            return this.emitCallError(client, error);
        }
    }

    @SkipThrottle()
    @SubscribeMessage('call:get_active')
    async getActiveCall(@MessageBody() data: ConversationCallPayload, @ConnectedSocket() client: AuthenticatedSocket) {
        try {
            const state = await this.callsService.getActiveCallForConversation(client.user.userId, data.conversationId);
            client.emit('call:active_sync', { calls: state ? [state] : [] });
            return { status: 'ack' };
        } catch (error) {
            return this.emitCallError(client, error);
        }
    }

    @SkipThrottle()
    @SubscribeMessage('call:sync_active')
    async syncActiveCalls(@ConnectedSocket() client: AuthenticatedSocket) {
        try {
            const calls = await this.callsService.getActiveCallsForUser(client.user.userId);
            client.emit('call:active_sync', { calls });
            return { status: 'ack' };
        } catch (error) {
            return this.emitCallError(client, error);
        }
    }

    @SubscribeMessage('call:accept')
    async acceptCall(@MessageBody() data: CallIdPayload, @ConnectedSocket() client: AuthenticatedSocket) {
        try {
            await this.callsService.acceptCall(client.user.userId, data.callId);
            return { status: 'ack' };
        } catch (error) {
            return this.emitCallError(client, error);
        }
    }

    @SubscribeMessage('call:join')
    async joinCall(@MessageBody() data: CallIdPayload, @ConnectedSocket() client: AuthenticatedSocket) {
        try {
            await this.callsService.joinCall(client.user.userId, data.callId);
            return { status: 'ack' };
        } catch (error) {
            return this.emitCallError(client, error);
        }
    }

    @SubscribeMessage('call:decline')
    async declineCall(@MessageBody() data: CallIdPayload, @ConnectedSocket() client: AuthenticatedSocket) {
        try {
            await this.callsService.declineCall(client.user.userId, data.callId);
            return { status: 'ack' };
        } catch (error) {
            return this.emitCallError(client, error);
        }
    }

    @SubscribeMessage('call:leave')
    async leaveCall(@MessageBody() data: CallIdPayload, @ConnectedSocket() client: AuthenticatedSocket) {
        try {
            await this.callsService.leaveCall(client.user.userId, data.callId);
            return { status: 'ack' };
        } catch (error) {
            return this.emitCallError(client, error);
        }
    }

    @SubscribeMessage('call:update_media')
    async updateMedia(@MessageBody() data: UpdateMediaPayload, @ConnectedSocket() client: AuthenticatedSocket) {
        try {
            await this.callsService.updateMediaState(client.user.userId, data.callId, {
                micEnabled: data.micEnabled,
                cameraEnabled: data.cameraEnabled,
            });
            return { status: 'ack' };
        } catch (error) {
            return this.emitCallError(client, error);
        }
    }

    @SkipThrottle()
    @SubscribeMessage('call:heartbeat')
    async heartbeat(@MessageBody() data: CallIdPayload, @ConnectedSocket() client: AuthenticatedSocket) {
        try {
            await this.callsService.heartbeat(client.user.userId, data.callId);
            return { status: 'ack' };
        } catch (error) {
            if (error instanceof ConflictException) {
                return { status: 'busy' };
            }

            return this.emitCallError(client, error);
        }
    }

    @SkipThrottle()
    @SubscribeMessage('call:media_connecting')
    async mediaConnecting(@MessageBody() data: CallIdPayload, @ConnectedSocket() client: AuthenticatedSocket) {
        return this.updateMediaConnectionStatus(client, data.callId, 'connecting');
    }

    @SkipThrottle()
    @SubscribeMessage('call:media_connected')
    async mediaConnected(@MessageBody() data: CallIdPayload, @ConnectedSocket() client: AuthenticatedSocket) {
        return this.updateMediaConnectionStatus(client, data.callId, 'connected');
    }

    @SkipThrottle()
    @SubscribeMessage('call:media_reconnecting')
    async mediaReconnecting(@MessageBody() data: CallIdPayload, @ConnectedSocket() client: AuthenticatedSocket) {
        return this.updateMediaConnectionStatus(client, data.callId, 'reconnecting');
    }

    @SkipThrottle()
    @SubscribeMessage('call:media_disconnected')
    async mediaDisconnected(@MessageBody() data: CallIdPayload, @ConnectedSocket() client: AuthenticatedSocket) {
        return this.updateMediaConnectionStatus(client, data.callId, 'disconnected');
    }

    @SkipThrottle()
    @SubscribeMessage('call:media_failed')
    async mediaFailed(@MessageBody() data: UpdateMediaConnectionPayload, @ConnectedSocket() client: AuthenticatedSocket) {
        return this.updateMediaConnectionStatus(client, data.callId, 'failed', data.failureReason);
    }

    private async emitCallMutation(result: CallMutationResult, includeRingingEvent = false) {
        if (result.ended) {
            await this.emitPublicStateToUsers('call:ended', result.memberIds, result.callId);
            return;
        }

        await this.emitPublicStateToUsers('call:state_updated', result.memberIds, result.callId);

        if (includeRingingEvent) {
            await this.emitPublicStateToUsers('call:ringing', result.ringingUserIds, result.callId);
        }
    }

    private async emitPublicStateToUsers(event: string, userIds: number[], callId: number) {
        await Promise.all(userIds.map(async (userId) => {
            const state = await this.callsService.getPublicCallState(callId, userId);
            this.server.to(`user_${userId}`).emit(event, state);
        }));
    }

    private async updateMediaConnectionStatus(
        client: AuthenticatedSocket,
        callId: number,
        status: CallParticipantMediaStatus,
        failureReason?: string | null,
    ) {
        try {
            await this.callsService.updateMediaConnectionStatus(client.user.userId, callId, { status, failureReason });
            return { status: 'ack' };
        } catch (error) {
            if (error instanceof ConflictException) {
                return { status: 'busy' };
            }

            return this.emitCallError(client, error);
        }
    }

    private emitCallError(client: AuthenticatedSocket, error: unknown) {
        const message = error instanceof Error ? error.message : 'Không thể xử lý cuộc gọi.';
        client.emit('call:error', { message });
        return { event: 'call:error', message };
    }
}
