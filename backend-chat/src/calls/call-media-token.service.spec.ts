import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CallMediaTokenService } from './call-media-token.service';
import { CALL_MEDIA_PROVIDER, type CallMediaProvider } from './call-media.types';
import { CallsService } from './calls.service';

describe('CallMediaTokenService', () => {
    let service: CallMediaTokenService;
    let callsService: { getMediaTokenContext: jest.Mock };
    let mediaProvider: CallMediaProvider;

    beforeEach(async () => {
        callsService = {
            getMediaTokenContext: jest.fn(),
        };
        mediaProvider = {
            provider: 'livekit',
            getClientConfig: jest.fn(() => ({
                provider: 'livekit',
                wsUrl: 'wss://example.livekit.cloud',
                connectOptions: { autoSubscribe: false },
                roomOptions: { adaptiveStream: true, dynacast: true },
                videoPageSize: 6,
            })),
            ensureRoom: jest.fn(),
            createParticipantToken: jest.fn(async () => ({
                token: 'token',
                expiresAt: new Date(Date.now() + 7_200_000).toISOString(),
            })),
            removeParticipant: jest.fn(),
            deleteRoom: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CallMediaTokenService,
                {
                    provide: CallsService,
                    useValue: callsService,
                },
                {
                    provide: CALL_MEDIA_PROVIDER,
                    useValue: mediaProvider,
                },
            ],
        }).compile();

        service = module.get<CallMediaTokenService>(CallMediaTokenService);
    });

    it('creates a LiveKit token for a joined call participant', async () => {
        callsService.getMediaTokenContext.mockResolvedValue({
            callId: 10,
            conversationId: 20,
            provider: 'livekit',
            roomName: 'livekit_conv_20_10',
            kind: 'video',
            user: {
                id: 2,
                username: 'guest',
                avatar: null,
            },
        });

        const result = await service.createToken(2, 10);

        expect(mediaProvider.createParticipantToken).toHaveBeenCalledWith({
            roomName: 'livekit_conv_20_10',
            identity: 'user:2',
            name: 'guest',
            ttlSeconds: 7200,
        });
        expect(result).toMatchObject({
            callId: 10,
            provider: 'livekit',
            wsUrl: 'wss://example.livekit.cloud',
            roomName: 'livekit_conv_20_10',
            token: 'token',
            participantIdentity: 'user:2',
            connectOptions: { autoSubscribe: false },
            roomOptions: { adaptiveStream: true, dynacast: true },
            videoPageSize: 6,
        });
    });

    it('does not issue tokens when the call service rejects membership or joined status', async () => {
        callsService.getMediaTokenContext.mockRejectedValue(new BadRequestException('Bạn cần tham gia cuộc gọi trước khi kết nối media.'));

        await expect(service.createToken(2, 10)).rejects.toBeInstanceOf(BadRequestException);
        expect(mediaProvider.createParticipantToken).not.toHaveBeenCalled();
    });
});
