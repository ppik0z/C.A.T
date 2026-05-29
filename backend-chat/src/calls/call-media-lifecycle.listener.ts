import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { CallMutationResult, CallProvider } from './calls.service';
import { CALL_MEDIA_PROVIDER, type CallMediaProvider } from './call-media.types';

interface CallParticipantLeftPayload {
    callId: number;
    conversationId: number;
    provider: CallProvider;
    roomName: string;
    userId: number;
}

@Injectable()
export class CallMediaLifecycleListener {
    private readonly logger = new Logger(CallMediaLifecycleListener.name);

    constructor(@Inject(CALL_MEDIA_PROVIDER) private readonly mediaProvider: CallMediaProvider) { }

    @OnEvent('call.started')
    async handleCallStarted(result: CallMutationResult) {
        if (result.state.provider !== 'livekit') return;

        try {
            await this.mediaProvider.ensureRoom({
                callId: result.callId,
                conversationId: result.conversationId,
                kind: result.state.kind,
                roomName: result.state.roomName,
            });
        } catch (error) {
            this.logger.warn(`Không thể tạo trước LiveKit room ${result.state.roomName}: ${this.toMessage(error)}`);
        }
    }

    @OnEvent('call.participant_left')
    async handleParticipantLeft(payload: CallParticipantLeftPayload) {
        if (payload.provider !== 'livekit') return;

        try {
            await this.mediaProvider.removeParticipant(payload.roomName, this.toParticipantIdentity(payload.userId));
        } catch (error) {
            this.logger.warn(`Không thể xoá participant khỏi LiveKit room ${payload.roomName}: ${this.toMessage(error)}`);
        }
    }

    @OnEvent('call.ended')
    async handleCallEnded(result: CallMutationResult) {
        if (result.state.provider !== 'livekit') return;

        try {
            await this.mediaProvider.deleteRoom(result.state.roomName);
        } catch (error) {
            this.logger.warn(`Không thể xoá LiveKit room ${result.state.roomName}: ${this.toMessage(error)}`);
        }
    }

    private toParticipantIdentity(userId: number): `user:${number}` {
        return `user:${userId}`;
    }

    private toMessage(error: unknown) {
        return error instanceof Error ? error.message : String(error);
    }
}
