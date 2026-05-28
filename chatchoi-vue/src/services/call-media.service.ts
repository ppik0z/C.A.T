import type {
  LocalVideoTrack,
  RemoteAudioTrack,
  RemoteTrackPublication,
  RemoteVideoTrack,
  Room,
  TrackPublication,
} from 'livekit-client';
import type { CallKind, CallMediaToken } from '../types/call';

export type CallMediaConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed';
export type CallVideoTrack = LocalVideoTrack | RemoteVideoTrack;
type LiveKitModule = typeof import('livekit-client');

export interface CallMediaSnapshot {
  participantIdentities: string[];
  activeSpeakerIdentities: string[];
  videoTracksByIdentity: Record<string, CallVideoTrack>;
}

export interface LocalMediaState {
  micEnabled: boolean;
  cameraEnabled: boolean;
}

interface ConnectCallMediaInput {
  callId: number;
  kind: CallKind;
  token: CallMediaToken;
  callbacks: {
    onStatusChange: (status: CallMediaConnectionStatus) => void;
    onSnapshot: (snapshot: CallMediaSnapshot) => void;
    onLocalMediaChange: (state: LocalMediaState) => void;
    onError: (message: string) => void;
  };
}

class CallMediaService {
  private room: Room | null = null;
  private activeCallId: number | null = null;
  private localIdentity: string | null = null;
  private visibleVideoIdentities = new Set<string>();
  private audioElements = new Map<string, HTMLMediaElement>();
  private callbacks: ConnectCallMediaInput['callbacks'] | null = null;
  private liveKitModule: LiveKitModule | null = null;

  async connect(input: ConnectCallMediaInput): Promise<void> {
    const liveKit = await this.getLiveKitModule();
    if (this.activeCallId === input.callId && this.room?.state === liveKit.ConnectionState.Connected) return;

    await this.disconnect();
    this.activeCallId = input.callId;
    this.localIdentity = input.token.participantIdentity;
    this.callbacks = input.callbacks;
    this.setStatus('connecting');

    const room = new liveKit.Room(input.token.roomOptions);
    this.room = room;
    this.bindRoomEvents(room, liveKit);

    try {
      await room.connect(input.token.wsUrl, input.token.token, input.token.connectOptions);
      await this.enableInitialLocalMedia(input.kind);
      this.syncSubscriptions();
      this.emitSnapshot();
    } catch (error) {
      this.callbacks?.onError(this.toMessage(error));
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    const room = this.room;
    this.room = null;
    this.activeCallId = null;
    this.localIdentity = null;
    this.visibleVideoIdentities.clear();
    this.detachAllAudio();

    if (room) {
      room.removeAllListeners();
      await room.disconnect(true);
    }

    this.emitSnapshot();
    this.callbacks = null;
  }

  setVisibleVideoIdentities(identities: string[]) {
    this.visibleVideoIdentities = new Set(identities);
    this.syncSubscriptions();
    this.emitSnapshot();
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    const room = this.ensureRoom();
    await room.localParticipant.setMicrophoneEnabled(enabled);
    this.callbacks?.onLocalMediaChange(this.getLocalMediaState());
    this.emitSnapshot();
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    const room = this.ensureRoom();
    await room.localParticipant.setCameraEnabled(enabled);
    this.callbacks?.onLocalMediaChange(this.getLocalMediaState());
    this.emitSnapshot();
  }

  getCurrentCallId() {
    return this.activeCallId;
  }

  private bindRoomEvents(room: Room, liveKit: LiveKitModule) {
    room.on(liveKit.RoomEvent.Connected, () => {
      this.setStatus('connected');
      this.emitSnapshot();
    });
    room.on(liveKit.RoomEvent.Reconnecting, () => this.setStatus('reconnecting'));
    room.on(liveKit.RoomEvent.SignalReconnecting, () => this.setStatus('reconnecting'));
    room.on(liveKit.RoomEvent.Reconnected, () => {
      this.setStatus('connected');
      this.syncSubscriptions();
      this.emitSnapshot();
    });
    room.on(liveKit.RoomEvent.Disconnected, () => {
      this.detachAllAudio();
      this.setStatus('disconnected');
      this.emitSnapshot();
    });
    room.on(liveKit.RoomEvent.ParticipantConnected, () => {
      this.syncSubscriptions();
      this.emitSnapshot();
    });
    room.on(liveKit.RoomEvent.ParticipantDisconnected, () => this.emitSnapshot());
    room.on(liveKit.RoomEvent.TrackPublished, () => {
      this.syncSubscriptions();
      this.emitSnapshot();
    });
    room.on(liveKit.RoomEvent.TrackUnpublished, (publication) => {
      this.detachAudio(publication.trackSid);
      this.emitSnapshot();
    });
    room.on(liveKit.RoomEvent.TrackSubscribed, (track, publication) => {
      if (track.kind === liveKit.Track.Kind.Audio) this.attachAudio(publication.trackSid, track as RemoteAudioTrack);
      this.emitSnapshot();
    });
    room.on(liveKit.RoomEvent.TrackUnsubscribed, (_track, publication) => {
      this.detachAudio(publication.trackSid);
      this.emitSnapshot();
    });
    room.on(liveKit.RoomEvent.TrackMuted, () => this.emitSnapshot());
    room.on(liveKit.RoomEvent.TrackUnmuted, () => this.emitSnapshot());
    room.on(liveKit.RoomEvent.LocalTrackPublished, () => this.emitSnapshot());
    room.on(liveKit.RoomEvent.LocalTrackUnpublished, () => this.emitSnapshot());
    room.on(liveKit.RoomEvent.ActiveSpeakersChanged, () => this.emitSnapshot());
  }

  private async enableInitialLocalMedia(kind: CallKind) {
    let micEnabled = false;
    let cameraEnabled = false;

    try {
      await this.room?.localParticipant.setMicrophoneEnabled(true);
      micEnabled = true;
    } catch (error) {
      this.callbacks?.onError(`Không thể bật micro: ${this.toMessage(error)}`);
    }

    if (kind === 'video') {
      try {
        await this.room?.localParticipant.setCameraEnabled(true);
        cameraEnabled = true;
      } catch (error) {
        this.callbacks?.onError(`Không thể bật camera: ${this.toMessage(error)}`);
      }
    }

    this.callbacks?.onLocalMediaChange({ micEnabled, cameraEnabled });
  }

  private syncSubscriptions() {
    if (!this.room || !this.liveKitModule) return;
    const { Track } = this.liveKitModule;

    this.room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        if (!this.isRemotePublication(publication)) return;

        if (publication.source === Track.Source.Microphone) {
          publication.setSubscribed(true);
          return;
        }

        if (publication.source === Track.Source.Camera) {
          publication.setSubscribed(this.visibleVideoIdentities.has(participant.identity));
        }
      });
    });
  }

  private emitSnapshot() {
    if (!this.callbacks) return;
    if (!this.room) {
      this.callbacks.onSnapshot({
        participantIdentities: [],
        activeSpeakerIdentities: [],
        videoTracksByIdentity: {},
      });
      return;
    }
    if (!this.liveKitModule) return;
    const { Track } = this.liveKitModule;

    const videoTracksByIdentity: Record<string, CallVideoTrack> = {};
    const localIdentity = this.room.localParticipant.identity || this.localIdentity;
    const localVideoTrack = this.room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
    if (localIdentity && localVideoTrack) videoTracksByIdentity[localIdentity] = localVideoTrack;

    this.room.remoteParticipants.forEach((participant) => {
      const videoTrack = participant.getTrackPublication(Track.Source.Camera)?.videoTrack;
      if (videoTrack) videoTracksByIdentity[participant.identity] = videoTrack as RemoteVideoTrack;
    });

    this.callbacks.onSnapshot({
      participantIdentities: [
        ...(localIdentity ? [localIdentity] : []),
        ...Array.from(this.room.remoteParticipants.values()).map((participant) => participant.identity),
      ],
      activeSpeakerIdentities: this.room.activeSpeakers.map((participant) => participant.identity),
      videoTracksByIdentity,
    });
  }

  private attachAudio(trackSid: string, track: RemoteAudioTrack) {
    if (this.audioElements.has(trackSid)) return;
    const element = track.attach();
    element.autoplay = true;
    element.hidden = true;
    element.dataset.callAudioTrack = trackSid;
    document.body.appendChild(element);
    this.audioElements.set(trackSid, element);
  }

  private detachAudio(trackSid: string) {
    const element = this.audioElements.get(trackSid);
    if (!element) return;
    element.remove();
    this.audioElements.delete(trackSid);
  }

  private detachAllAudio() {
    this.audioElements.forEach((element) => element.remove());
    this.audioElements.clear();
  }

  private getLocalMediaState(): LocalMediaState {
    const Track = this.liveKitModule?.Track;
    const microphone = Track ? this.room?.localParticipant.getTrackPublication(Track.Source.Microphone) : null;
    const camera = Track ? this.room?.localParticipant.getTrackPublication(Track.Source.Camera) : null;
    return {
      micEnabled: Boolean(microphone && !microphone.isMuted),
      cameraEnabled: Boolean(camera && !camera.isMuted),
    };
  }

  private setStatus(status: CallMediaConnectionStatus) {
    this.callbacks?.onStatusChange(status);
  }

  private ensureRoom() {
    if (!this.room) throw new Error('Chưa kết nối media cho cuộc gọi.');
    return this.room;
  }

  private isRemotePublication(publication: TrackPublication): publication is RemoteTrackPublication {
    return !publication.isLocal;
  }

  private async getLiveKitModule() {
    if (!this.liveKitModule) {
      this.liveKitModule = await import('livekit-client');
    }

    return this.liveKitModule;
  }

  private toMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Không thể kết nối media.';
  }
}

export const callMediaService = new CallMediaService();
