import { Test, TestingModule } from '@nestjs/testing';
import { CallMediaLifecycleListener } from './call-media-lifecycle.listener';
import { CALL_MEDIA_PROVIDER, type CallMediaProvider } from './call-media.types';
import type { CallMutationResult } from './calls.service';

describe('CallMediaLifecycleListener', () => {
    let listener: CallMediaLifecycleListener;
    let mediaProvider: CallMediaProvider;

    const mutationResult = (provider: 'livekit' | 'stub' = 'livekit'): CallMutationResult => ({
        callId: 10,
        conversationId: 20,
        memberIds: [1, 2],
        ringingUserIds: [],
        ended: false,
        state: {
            id: 10,
            conversationId: 20,
            isGroup: true,
            kind: 'video',
            status: 'active',
            provider,
            roomName: `${provider}_conv_20_10`,
            startedBy: { id: 1, username: 'starter', avatar: null },
            startedAt: new Date().toISOString(),
            answeredAt: new Date().toISOString(),
            endedAt: null,
            endedReason: null,
            ringExpiresAt: null,
            participants: [],
        },
    });

    beforeEach(async () => {
        mediaProvider = {
            provider: 'livekit',
            getClientConfig: jest.fn(),
            ensureRoom: jest.fn(),
            createParticipantToken: jest.fn(),
            removeParticipant: jest.fn(),
            deleteRoom: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CallMediaLifecycleListener,
                {
                    provide: CALL_MEDIA_PROVIDER,
                    useValue: mediaProvider,
                },
            ],
        }).compile();

        listener = module.get<CallMediaLifecycleListener>(CallMediaLifecycleListener);
    });

    it('creates the LiveKit room when a livekit call starts', async () => {
        await listener.handleCallStarted(mutationResult());

        expect(mediaProvider.ensureRoom).toHaveBeenCalledWith({
            callId: 10,
            conversationId: 20,
            kind: 'video',
            roomName: 'livekit_conv_20_10',
        });
    });

    it('removes a LiveKit participant when a participant leaves', async () => {
        await listener.handleParticipantLeft({
            callId: 10,
            conversationId: 20,
            provider: 'livekit',
            roomName: 'livekit_conv_20_10',
            userId: 2,
        });

        expect(mediaProvider.removeParticipant).toHaveBeenCalledWith('livekit_conv_20_10', 'user:2');
    });

    it('deletes the LiveKit room when the call ends', async () => {
        await listener.handleCallEnded(mutationResult());

        expect(mediaProvider.deleteRoom).toHaveBeenCalledWith('livekit_conv_20_10');
    });

    it('ignores legacy stub calls', async () => {
        await listener.handleCallStarted(mutationResult('stub'));
        await listener.handleCallEnded(mutationResult('stub'));

        expect(mediaProvider.ensureRoom).not.toHaveBeenCalled();
        expect(mediaProvider.deleteRoom).not.toHaveBeenCalled();
    });
});
