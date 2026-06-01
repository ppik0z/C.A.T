import { Inject, Injectable } from '@nestjs/common';
import { CallsService } from './calls.service';
import { CALL_MEDIA_PROVIDER, type CallMediaProvider } from './call-media.types';

const DEFAULT_TOKEN_TTL_SECONDS = 2 * 60 * 60;

export interface CallMediaTokenResponse {
    callId: number;
    provider: 'livekit';
    wsUrl: string;
    roomName: string;
    token: string;
    expiresAt: string;
    participantIdentity: `user:${number}`;
    connectOptions: { autoSubscribe: false };
    roomOptions: { adaptiveStream: true; dynacast: true };
    videoPageSize: number;
}

@Injectable()
export class CallMediaTokenService {
    private readonly ttlSeconds = this.parsePositiveInt(process.env.LIVEKIT_TOKEN_TTL_SECONDS, DEFAULT_TOKEN_TTL_SECONDS);

    constructor(
        private readonly callsService: CallsService,
        @Inject(CALL_MEDIA_PROVIDER) private readonly mediaProvider: CallMediaProvider,
    ) { }

    async createToken(userId: number, callId: number): Promise<CallMediaTokenResponse> {
        const context = await this.callsService.getMediaTokenContext(userId, callId);
        const participantIdentity = this.toParticipantIdentity(context.user.id);
        const token = await this.mediaProvider.createParticipantToken({
            roomName: context.roomName,
            identity: participantIdentity,
            name: context.user.displayName || context.user.username,
            ttlSeconds: this.ttlSeconds,
        });
        const clientConfig = this.mediaProvider.getClientConfig();

        return {
            callId: context.callId,
            provider: clientConfig.provider,
            wsUrl: clientConfig.wsUrl,
            roomName: context.roomName,
            token: token.token,
            expiresAt: token.expiresAt,
            participantIdentity,
            connectOptions: clientConfig.connectOptions,
            roomOptions: clientConfig.roomOptions,
            videoPageSize: clientConfig.videoPageSize,
        };
    }

    private toParticipantIdentity(userId: number): `user:${number}` {
        return `user:${userId}`;
    }

    private parsePositiveInt(value: string | undefined, fallback: number) {
        if (!value) return fallback;
        const parsed = Number(value);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
    }
}
