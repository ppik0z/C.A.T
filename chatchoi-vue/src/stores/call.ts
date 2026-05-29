import { defineStore } from 'pinia';
import { socket } from '../socket';
import { fetchActiveCalls as fetchActiveCallsRequest } from '../services/call.service';
import type { CallKind, CallState } from '../types/call';
import { useChatStore } from './chat';

interface PendingOutgoingCall {
  conversationId: number;
  kind: CallKind;
  startedAt: number;
}

const incomingTimers = new Map<number, ReturnType<typeof setTimeout>>();
const heartbeatTimers = new Map<number, ReturnType<typeof setInterval>>();
let callErrorTimer: ReturnType<typeof setTimeout> | null = null;

const CALL_ERROR_TTL_MS = 3_500;

const clearCallErrorTimer = () => {
  if (!callErrorTimer) return;
  clearTimeout(callErrorTimer);
  callErrorTimer = null;
};

const isTerminalCallStatus = (status: CallState['status']) => {
  return status === 'ended' || status === 'missed' || status === 'cancelled';
};

export const useCallStore = defineStore('call', {
  state: () => ({
    callsByConversationId: {} as Record<number, CallState>,
    incomingCallIds: [] as number[],
    overlayCallId: null as number | null,
    pendingOutgoing: null as PendingOutgoingCall | null,
    callError: null as string | null,
  }),

  getters: {
    activeOverlayCall(state): CallState | null {
      if (!state.overlayCallId) return null;
      return Object.values(state.callsByConversationId).find((call) => call.id === state.overlayCallId) ?? null;
    },

    incomingCalls(state): CallState[] {
      return state.incomingCallIds
        .map((callId) => Object.values(state.callsByConversationId).find((call) => call.id === callId))
        .filter((call): call is CallState => Boolean(call));
    },

    getCallByConversationId: (state) => {
      return (conversationId: number): CallState | null => state.callsByConversationId[conversationId] ?? null;
    },
  },

  actions: {
    async loadActiveCalls(token: string) {
      try {
        const calls = await fetchActiveCallsRequest(token);
        this.applyActiveSync(calls);
      } catch (error) {
        this.setCallError(error instanceof Error ? error.message : 'Không thể đồng bộ cuộc gọi.');
      }
    },

    syncActiveCalls() {
      socket.emit('call:sync_active');
    },

    requestConversationActiveCall(conversationId: number) {
      socket.emit('call:get_active', { conversationId });
    },

    startCall(conversationId: number, kind: CallKind) {
      this.dismissError();
      this.pendingOutgoing = {
        conversationId,
        kind,
        startedAt: Date.now(),
      };
      socket.emit('call:start', { conversationId, kind });
    },

    acceptCall(callId: number) {
      this.overlayCallId = callId;
      this.removeIncomingCall(callId);
      socket.emit('call:accept', { callId });
    },

    joinCall(callId: number) {
      this.overlayCallId = callId;
      socket.emit('call:join', { callId });
    },

    declineCall(callId: number) {
      this.removeIncomingCall(callId);
      socket.emit('call:decline', { callId });
    },

    leaveCall(callId: number) {
      if (this.activeOverlayCall?.id === callId) {
        this.overlayCallId = null;
      }
      if (this.pendingOutgoing) {
        this.pendingOutgoing = null;
      }
      this.stopHeartbeat(callId);
      socket.emit('call:leave', { callId });
    },

    updateMediaState(callId: number, input: { micEnabled: boolean; cameraEnabled: boolean }) {
      socket.emit('call:update_media', {
        callId,
        micEnabled: input.micEnabled,
        cameraEnabled: input.cameraEnabled,
      });
    },

    toggleMic(callId: number) {
      const call = this.findCallById(callId);
      const participant = call?.participants.find((item) => item.status === 'joined' && item.userId === this.getCurrentUserId());
      if (!call || !participant) return;

      this.updateMediaState(callId, {
        micEnabled: !participant.micEnabled,
        cameraEnabled: participant.cameraEnabled,
      });
    },

    toggleCamera(callId: number) {
      const call = this.findCallById(callId);
      const participant = call?.participants.find((item) => item.status === 'joined' && item.userId === this.getCurrentUserId());
      if (!call || !participant) return;

      this.updateMediaState(callId, {
        micEnabled: participant.micEnabled,
        cameraEnabled: !participant.cameraEnabled,
      });
    },

    applyActiveSync(calls: CallState[]) {
      calls.forEach((call) => {
        if (isTerminalCallStatus(call.status)) {
          this.applyCallEnded(call);
          return;
        }

        if (call.currentUserStatus === 'ringing' && call.status === 'ringing') {
          this.applyRinging(call);
          return;
        }

        this.applyCallState(call);
      });
    },

    applyRinging(call: CallState) {
      this.upsertCall(call);
      if (call.currentUserStatus === 'ringing') {
        this.addIncomingCall(call);
      }
    },

    applyCallState(call: CallState) {
      this.upsertCall(call);

      if (call.currentUserStatus !== 'ringing') {
        this.removeIncomingCall(call.id);
      }

      if (call.currentUserStatus === 'joined') {
        this.pendingOutgoing = null;
        this.overlayCallId = call.id;
        this.startHeartbeat(call.id);
        return;
      }

      if (this.overlayCallId === call.id) {
        this.overlayCallId = null;
        this.stopHeartbeat(call.id);
      }
    },

    applyCallEnded(call: CallState) {
      this.upsertCall(call);
      this.removeIncomingCall(call.id);

      if (this.overlayCallId === call.id) {
        this.overlayCallId = null;
      }

      if (this.pendingOutgoing?.conversationId === call.conversationId) {
        this.pendingOutgoing = null;
      }

      this.stopHeartbeat(call.id);
      setTimeout(() => {
        const currentCall = this.callsByConversationId[call.conversationId];
        if (currentCall?.id === call.id && isTerminalCallStatus(currentCall.status)) {
          delete this.callsByConversationId[call.conversationId];
        }
      }, 2500);
    },

    setCallError(message: string) {
      clearCallErrorTimer();
      this.callError = message;
      this.pendingOutgoing = null;
      callErrorTimer = setTimeout(() => {
        if (this.callError === message) {
          this.callError = null;
        }
        callErrorTimer = null;
      }, CALL_ERROR_TTL_MS);
    },

    expireIncomingCall(callId: number) {
      const call = this.findCallById(callId);
      this.removeIncomingCall(callId);
      if (!call || call.status !== 'ringing') return;

      this.applyCallEnded({
        ...call,
        status: 'missed',
        endedAt: new Date().toISOString(),
        endedReason: 'local_timeout',
        ringExpiresAt: null,
        currentUserStatus: call.currentUserStatus === 'ringing' ? 'missed' : call.currentUserStatus,
        participants: call.participants.map((participant) => {
          return participant.status === 'ringing'
            ? { ...participant, status: 'missed' }
            : participant;
        }),
      });
    },

    dismissError() {
      clearCallErrorTimer();
      this.callError = null;
    },

    upsertCall(call: CallState) {
      this.callsByConversationId[call.conversationId] = call;
    },

    addIncomingCall(call: CallState) {
      if (!this.incomingCallIds.includes(call.id)) {
        this.incomingCallIds.push(call.id);
      }
      this.scheduleIncomingTimeout(call);
    },

    removeIncomingCall(callId: number) {
      this.incomingCallIds = this.incomingCallIds.filter((id) => id !== callId);
      const timer = incomingTimers.get(callId);
      if (timer) clearTimeout(timer);
      incomingTimers.delete(callId);
    },

    scheduleIncomingTimeout(call: CallState) {
      const timer = incomingTimers.get(call.id);
      if (timer) clearTimeout(timer);

      const timeoutAt = call.ringExpiresAt ? new Date(call.ringExpiresAt).getTime() : Date.now() + 60_000;
      const delay = Math.max(timeoutAt - Date.now(), 0);
      incomingTimers.set(call.id, setTimeout(() => {
        this.expireIncomingCall(call.id);
      }, delay));
    },

    startHeartbeat(callId: number) {
      this.stopHeartbeat(callId);
      heartbeatTimers.set(callId, setInterval(() => {
        const call = this.findCallById(callId);
        if (!call || call.currentUserStatus !== 'joined' || isTerminalCallStatus(call.status)) {
          this.stopHeartbeat(callId);
          return;
        }
        socket.emit('call:heartbeat', { callId });
      }, 10_000));
    },

    stopHeartbeat(callId?: number) {
      if (callId !== undefined) {
        const timer = heartbeatTimers.get(callId);
        if (timer) {
          clearInterval(timer);
          heartbeatTimers.delete(callId);
        }
        return;
      }
      heartbeatTimers.forEach((timer) => clearInterval(timer));
      heartbeatTimers.clear();
    },

    findCallById(callId: number): CallState | null {
      return Object.values(this.callsByConversationId).find((call) => call.id === callId) ?? null;
    },

    getCurrentUserId() {
      return useChatStore().myId;
    },
  },
});
