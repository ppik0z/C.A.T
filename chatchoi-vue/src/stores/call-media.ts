import { markRaw } from 'vue';
import { defineStore } from 'pinia';
import { socket } from '../socket';
import { createCallMediaToken } from '../services/call.service';
import {
  callMediaService,
  type CallMediaConnectionStatus,
  type CallMediaSnapshot,
  type CallVideoTrack,
  type LocalMediaState,
} from '../services/call-media.service';
import type { CallState } from '../types/call';
import { useCallStore } from './call';
import { getAccessToken } from '../services/session.runtime';

const toParticipantIdentity = (userId: number): `user:${number}` => `user:${userId}`;

const mediaStatusEventByStatus: Record<Exclude<CallMediaConnectionStatus, 'idle' | 'taken_over'>, string> = {
  connecting: 'call:media_connecting',
  connected: 'call:media_connected',
  reconnecting: 'call:media_reconnecting',
  disconnected: 'call:media_disconnected',
  failed: 'call:media_failed',
};

export const useCallMediaStore = defineStore('call-media', {
  state: () => ({
    activeCallId: null as number | null,
    connectionStatus: 'idle' as CallMediaConnectionStatus,
    error: null as string | null,
    participantIdentities: [] as string[],
    activeSpeakerIdentities: [] as string[],
    videoTracksByIdentity: {} as Record<string, CallVideoTrack>,
    videoPageIndex: 0,
    videoPageSize: 6,
  }),

  getters: {
    isConnected(state) {
      return state.connectionStatus === 'connected' || state.connectionStatus === 'reconnecting';
    },

    pageCount(state) {
      return Math.max(1, Math.ceil(state.participantIdentities.length / state.videoPageSize));
    },
  },

  actions: {
    async connectForCall(call: CallState, forceConnect = false) {
      if (call.provider !== 'livekit' || call.currentUserStatus !== 'joined') return;
      if (this.activeCallId === call.id && ['connecting', 'connected', 'reconnecting'].includes(this.connectionStatus)) {
        this.syncVideoPage(call);
        return;
      }

      // Pre-connection check: media đang active ở tab/thiết bị khác?
      if (!forceConnect) {
        const myParticipant = this.getCurrentParticipant(call.id)
          ?? call.participants.find((p) => p.userId === useCallStore().getCurrentUserId());
        if (myParticipant && ['connecting', 'connected', 'reconnecting'].includes(myParticipant.mediaStatus)) {
          this.activeCallId = call.id;
          this.connectionStatus = 'taken_over';
          return;
        }
      }

      const token = getAccessToken();
      if (!token) {
        this.setError('Bạn cần đăng nhập để kết nối media.');
        return;
      }

      const callId = call.id;
      this.activeCallId = callId;
      this.error = null;

      try {
        const mediaToken = await createCallMediaToken(callId);
        this.videoPageSize = mediaToken.videoPageSize;
        const store = this;

        await callMediaService.connect({
          callId,
          kind: call.kind,
          token: mediaToken,
          callbacks: {
            onStatusChange(status) {
              store.applyConnectionStatus(callId, status);
            },
            onSnapshot(snapshot) {
              store.applySnapshot(snapshot);
            },
            onLocalMediaChange(state) {
              store.applyLocalMediaState(callId, state);
            },
            onError(message) {
              store.setError(message);
            },
          },
        });

        this.syncVideoPage(call);
      } catch (error) {
        this.applyConnectionStatus(callId, 'failed', error instanceof Error ? error.message : 'Không thể kết nối media.');
      }
    },

    async disconnectForCall(callId: number, notifyBackend = true) {
      if (this.activeCallId !== callId) return;
      await callMediaService.disconnect();
      if (notifyBackend) socket.emit('call:media_disconnected', { callId });
      this.resetMediaState();
    },

    syncVideoPage(call: CallState) {
      if (this.activeCallId !== call.id) return;

      const joinedIdentities = call.participants
        .filter((participant) => participant.status === 'joined')
        .map((participant) => toParticipantIdentity(participant.userId));
      const pageCount = Math.max(1, Math.ceil(joinedIdentities.length / this.videoPageSize));
      if (this.videoPageIndex >= pageCount) this.videoPageIndex = pageCount - 1;

      const startIndex = this.videoPageIndex * this.videoPageSize;
      callMediaService.setVisibleVideoIdentities(joinedIdentities.slice(startIndex, startIndex + this.videoPageSize));
    },

    nextVideoPage(call: CallState) {
      const joinedCount = call.participants.filter((participant) => participant.status === 'joined').length;
      const pageCount = Math.max(1, Math.ceil(joinedCount / this.videoPageSize));
      this.videoPageIndex = Math.min(this.videoPageIndex + 1, pageCount - 1);
      this.syncVideoPage(call);
    },

    previousVideoPage(call: CallState) {
      this.videoPageIndex = Math.max(this.videoPageIndex - 1, 0);
      this.syncVideoPage(call);
    },

    async setMicEnabled(callId: number, enabled: boolean) {
      try {
        await callMediaService.setMicrophoneEnabled(enabled);
      } catch (error) {
        this.setError(error instanceof Error ? error.message : 'Không thể cập nhật micro.');
        useCallStore().updateMediaState(callId, { micEnabled: false, cameraEnabled: this.getCurrentCameraEnabled(callId) });
      }
    },

    async setCameraEnabled(callId: number, enabled: boolean) {
      try {
        await callMediaService.setCameraEnabled(enabled);
      } catch (error) {
        this.setError(error instanceof Error ? error.message : 'Không thể cập nhật camera.');
        useCallStore().updateMediaState(callId, { micEnabled: this.getCurrentMicEnabled(callId), cameraEnabled: false });
      }
    },

    getVideoTrackForUser(userId: number) {
      return this.videoTracksByIdentity[toParticipantIdentity(userId)] ?? null;
    },

    isActiveSpeaker(userId: number) {
      return this.activeSpeakerIdentities.includes(toParticipantIdentity(userId));
    },

    applyConnectionStatus(callId: number, status: CallMediaConnectionStatus, failureReason?: string) {
      if (this.activeCallId !== callId) this.activeCallId = callId;
      if (this.connectionStatus === status && status !== 'failed') return;

      this.connectionStatus = status;
      if (status === 'idle' || status === 'taken_over') return;

      const event = mediaStatusEventByStatus[status];
      socket.emit(event, { callId, failureReason });
    },

    applySnapshot(snapshot: CallMediaSnapshot) {
      this.participantIdentities = snapshot.participantIdentities;
      this.activeSpeakerIdentities = snapshot.activeSpeakerIdentities;
      this.videoTracksByIdentity = Object.fromEntries(
        Object.entries(snapshot.videoTracksByIdentity).map(([identity, track]) => [identity, markRaw(track)]),
      ) as Record<string, CallVideoTrack>;
    },

    applyLocalMediaState(callId: number, state: LocalMediaState) {
      useCallStore().updateMediaState(callId, state);
    },

    setError(message: string) {
      this.error = message;
    },

    resetMediaState() {
      this.activeCallId = null;
      this.connectionStatus = 'idle';
      this.error = null;
      this.participantIdentities = [];
      this.activeSpeakerIdentities = [];
      this.videoTracksByIdentity = {};
      this.videoPageIndex = 0;
      this.videoPageSize = 6;
    },

    getCurrentMicEnabled(callId: number) {
      const participant = this.getCurrentParticipant(callId);
      return Boolean(participant?.micEnabled);
    },

    getCurrentCameraEnabled(callId: number) {
      const participant = this.getCurrentParticipant(callId);
      return Boolean(participant?.cameraEnabled);
    },

    getCurrentParticipant(callId: number) {
      const callStore = useCallStore();
      const call = callStore.findCallById(callId);
      const userId = callStore.getCurrentUserId();
      return call?.participants.find((participant) => participant.userId === userId) ?? null;
    },
  },
});
