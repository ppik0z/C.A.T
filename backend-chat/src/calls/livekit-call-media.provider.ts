import { Injectable } from '@nestjs/common';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import type {
    CallMediaClientConfig,
    CallMediaProvider,
    CreateParticipantTokenInput,
    EnsureCallRoomInput,
    ParticipantTokenResult,
} from './call-media.types';

const DEFAULT_VIDEO_PAGE_SIZE = 6;
const DEFAULT_ROOM_EMPTY_TIMEOUT_SECONDS = 60;
const DEFAULT_ROOM_DEPARTURE_TIMEOUT_SECONDS = 60;

@Injectable()
export class LiveKitCallMediaProvider implements CallMediaProvider {
    readonly provider = 'livekit' as const;

    private readonly wsUrl = this.requireEnv('LIVEKIT_URL');
    private readonly apiKey = this.requireEnv('LIVEKIT_API_KEY');
    private readonly apiSecret = this.requireEnv('LIVEKIT_API_SECRET');
    private readonly roomService = new RoomServiceClient(this.toHttpUrl(this.wsUrl), this.apiKey, this.apiSecret);
    private readonly videoPageSize = this.parsePositiveInt(process.env.LIVEKIT_VIDEO_PAGE_SIZE, DEFAULT_VIDEO_PAGE_SIZE);

    getClientConfig(): CallMediaClientConfig {
        return {
            provider: this.provider,
            wsUrl: this.wsUrl,
            connectOptions: { autoSubscribe: false },
            roomOptions: { adaptiveStream: true, dynacast: true },
            videoPageSize: this.videoPageSize,
        };
    }

    async ensureRoom(input: EnsureCallRoomInput): Promise<void> {
        try {
            await this.roomService.createRoom({
                name: input.roomName,
                emptyTimeout: DEFAULT_ROOM_EMPTY_TIMEOUT_SECONDS,
                departureTimeout: DEFAULT_ROOM_DEPARTURE_TIMEOUT_SECONDS,
                metadata: JSON.stringify({
                    callId: input.callId,
                    conversationId: input.conversationId,
                    kind: input.kind,
                }),
            });
        } catch (error) {
            if (this.isAlreadyExistsError(error)) return;
            throw error;
        }
    }

    async createParticipantToken(input: CreateParticipantTokenInput): Promise<ParticipantTokenResult> {
        const accessToken = new AccessToken(this.apiKey, this.apiSecret, {
            identity: input.identity,
            name: input.name,
            ttl: input.ttlSeconds,
        });

        accessToken.addGrant({
            roomJoin: true,
            room: input.roomName,
            canPublish: true,
            canSubscribe: true,
            canPublishData: false,
        });

        return {
            token: await accessToken.toJwt(),
            expiresAt: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
        };
    }

    async removeParticipant(roomName: string, participantIdentity: string): Promise<void> {
        try {
            await this.roomService.removeParticipant(roomName, participantIdentity);
        } catch (error) {
            if (this.isNotFoundError(error)) return;
            throw error;
        }
    }

    async deleteRoom(roomName: string): Promise<void> {
        try {
            await this.roomService.deleteRoom(roomName);
        } catch (error) {
            if (this.isNotFoundError(error)) return;
            throw error;
        }
    }

    private requireEnv(name: string) {
        const value = process.env[name];
        if (!value) throw new Error(`${name} is required for LiveKit calls`);
        return value;
    }

    private toHttpUrl(url: string) {
        const parsed = new URL(url);
        if (parsed.protocol === 'wss:') parsed.protocol = 'https:';
        if (parsed.protocol === 'ws:') parsed.protocol = 'http:';
        return parsed.toString();
    }

    private parsePositiveInt(value: string | undefined, fallback: number) {
        if (!value) return fallback;
        const parsed = Number(value);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
    }

    private isAlreadyExistsError(error: unknown) {
        const message = this.getErrorMessage(error).toLowerCase();
        return message.includes('already exists') || message.includes('already_exists');
    }

    private isNotFoundError(error: unknown) {
        const message = this.getErrorMessage(error).toLowerCase();
        return message.includes('not found') || message.includes('not_found');
    }

    private getErrorMessage(error: unknown) {
        return error instanceof Error ? error.message : String(error);
    }
}
