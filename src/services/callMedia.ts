// The only browser file that knows the media provider is LiveKit. The call screen talks to this, so the provider
// can be swapped without touching the UI. Imported only by the call page, which is loaded on its own, so the SDK
// never reaches other pages. Nothing here is recorded or stored.
import {
  ConnectionState, createLocalAudioTrack, createLocalVideoTrack, DisconnectReason, LocalAudioTrack, LocalVideoTrack,
  Room, RoomEvent, Track, type Participant,
} from 'livekit-client';
import type { MediaState } from '@/lib/callState';

/** Something a <video> or <audio> element can show, without exposing the provider's track type. */
export interface MediaRef { attach(el: HTMLMediaElement): void; detach(el: HTMLMediaElement): void }
export interface PersonMedia { id: string; video: MediaRef | null; audio: MediaRef | null; micOn: boolean; camOn: boolean; speaking: boolean }
export interface MediaSnapshot {
  state: MediaState; local: PersonMedia; remotes: PersonMedia[];
  /** The browser blocked sound until a tap (autoplay rules). */
  needsAudioTap: boolean;
  /** Why the connection ended: the other side closed it, we left, or it was lost. */
  ended: 'closed' | 'left' | 'lost' | null;
  deviceError: string | null;
}
export type DeviceKind = 'audioinput' | 'videoinput' | 'audiooutput';

// One wrapper per track, so a screen re-rendering doesn't detach and reattach the same video.
const refs = new WeakMap<Track, MediaRef>();
const ref = (t: Track | undefined | null): MediaRef | null => {
  if (!t) return null;
  let r = refs.get(t);
  if (!r) { r = { attach: (el) => { t.attach(el); }, detach: (el) => { t.detach(el); } }; refs.set(t, r); }
  return r;
};

/** Camera and microphone before joining. Each can fail on its own; the call can go ahead without either. */
export class Preview {
  audio: LocalAudioTrack | null = null;
  video: LocalVideoTrack | null = null;
  async start(want: { audio: boolean; video: boolean; audioId?: string; videoId?: string }) {
    const errors: { camera?: unknown; microphone?: unknown } = {};
    if (want.audio && !this.audio) {
      try { this.audio = await createLocalAudioTrack({ deviceId: want.audioId, echoCancellation: true, noiseSuppression: true }); }
      catch (e) { errors.microphone = e; }
    }
    if (want.video && !this.video) {
      try { this.video = await createLocalVideoTrack({ deviceId: want.videoId, resolution: { width: 1280, height: 720, frameRate: 24 } }); }
      catch (e) { errors.camera = e; }
    }
    return errors;
  }
  async setVideo(on: boolean, videoId?: string) {
    if (on) return (await this.start({ audio: false, video: true, videoId })).camera;
    this.video?.stop(); this.video = null; return undefined;
  }
  async setAudio(on: boolean, audioId?: string) {
    if (on) return (await this.start({ audio: true, video: false, audioId })).microphone;
    this.audio?.stop(); this.audio = null; return undefined;
  }
  async switchDevice(kind: 'audioinput' | 'videoinput', id: string) {
    await (kind === 'audioinput' ? this.audio : this.video)?.restartTrack({ deviceId: id });
  }
  videoRef = () => ref(this.video);
  /** Hands the tracks to the call, or stops them. Either way this preview no longer owns them. */
  take() { const t = { audio: this.audio, video: this.video }; this.audio = null; this.video = null; return t; }
  stop() { this.audio?.stop(); this.video?.stop(); this.audio = null; this.video = null; }
}

export const listDevices = (kind: DeviceKind) => Room.getLocalDevices(kind, false).catch(() => [] as MediaDeviceInfo[]);

export class CallMedia {
  private room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });
  private listeners = new Set<(s: MediaSnapshot) => void>();
  private state: MediaState = 'idle';
  private ended: MediaSnapshot['ended'] = null;
  private deviceError: string | null = null;
  private left = false;
  snapshot: MediaSnapshot = this.build();

  constructor() {
    const r = this.room; const emit = () => this.emit();
    r.on(RoomEvent.ConnectionStateChanged, (s) => {
      if (s === ConnectionState.Connected) this.state = 'connected';
      else if (s === ConnectionState.Reconnecting || s === ConnectionState.SignalReconnecting) this.state = 'reconnecting';
      else if (s === ConnectionState.Connecting) this.state = 'connecting';
      emit();
    });
    r.on(RoomEvent.Disconnected, (reason) => {
      this.state = 'disconnected';
      this.ended = this.left || reason === DisconnectReason.CLIENT_INITIATED ? 'left'
        : reason === DisconnectReason.ROOM_DELETED || reason === DisconnectReason.PARTICIPANT_REMOVED || reason === DisconnectReason.DUPLICATE_IDENTITY ? 'closed' : 'lost';
      emit();
    });
    r.on(RoomEvent.MediaDevicesError, () => { this.deviceError = 'Your camera or microphone stopped working. Check it is connected, then turn it off and on.'; emit(); });
    for (const ev of [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished,
      RoomEvent.ActiveSpeakersChanged, RoomEvent.AudioPlaybackStatusChanged] as const) r.on(ev, emit);
  }

  subscribe(fn: (s: MediaSnapshot) => void) { this.listeners.add(fn); fn(this.snapshot); return () => { this.listeners.delete(fn); }; }

  async connect(url: string, token: string, tracks: { audio: LocalAudioTrack | null; video: LocalVideoTrack | null }) {
    this.state = 'connecting'; this.emit();
    try {
      await this.room.connect(url, token);
      if (this.left) { await this.room.disconnect(); return; }
      this.state = 'connected';
    } catch (e) {
      tracks.audio?.stop(); tracks.video?.stop();
      if (!this.left) this.state = 'failed';
      this.emit();
      throw e;
    }
    this.emit();
    // A device that can't be shared doesn't end the call: try once more, then carry on and say which one.
    const publish = async (t: LocalAudioTrack | LocalVideoTrack, what: 'microphone' | 'camera') => {
      for (let attempt = 0; attempt < 2 && !this.left; attempt += 1) {
        try { await this.room.localParticipant.publishTrack(t, what === 'camera' ? { simulcast: true } : {}); this.emit(); return; }
        catch { await new Promise((r) => setTimeout(r, 1000)); }
      }
      t.stop();
      if (!this.left) { this.deviceError = `Your ${what} couldn't be shared. Turn it off and on to try again.`; this.emit(); }
    };
    await Promise.all([tracks.audio && publish(tracks.audio, 'microphone'), tracks.video && publish(tracks.video, 'camera')]);
  }

  async setMic(on: boolean) { this.deviceError = null; await this.room.localParticipant.setMicrophoneEnabled(on); this.emit(); }
  async setCamera(on: boolean) { this.deviceError = null; await this.room.localParticipant.setCameraEnabled(on); this.emit(); }
  async switchDevice(kind: DeviceKind, id: string) { await this.room.switchActiveDevice(kind, id); this.emit(); }
  startAudio() { return this.room.startAudio().then(() => this.emit()); }

  /** Disconnects and stops the camera and microphone. Safe to call more than once. */
  async leave() {
    this.left = true;
    this.room.localParticipant.getTrackPublications().forEach((p) => p.track?.stop());
    await this.room.disconnect(true).catch(() => undefined);
    this.state = 'disconnected'; this.ended = 'left'; this.emit();
  }

  private person(p: Participant, local: boolean): PersonMedia {
    const cam = p.getTrackPublication(Track.Source.Camera); const mic = p.getTrackPublication(Track.Source.Microphone);
    return {
      id: p.identity,
      video: cam && !cam.isMuted ? ref(cam.track) : null,
      audio: local ? null : ref(mic?.track),
      camOn: !!cam && !cam.isMuted, micOn: !!mic && !mic.isMuted, speaking: p.isSpeaking,
    };
  }
  private build(): MediaSnapshot {
    const r = this.room;
    return {
      state: this.state, ended: this.ended, deviceError: this.deviceError,
      local: this.person(r.localParticipant, true),
      remotes: [...r.remoteParticipants.values()].map((p) => this.person(p, false)),
      needsAudioTap: this.state === 'connected' && !r.canPlaybackAudio,
    };
  }
  private emit() { this.snapshot = this.build(); this.listeners.forEach((fn) => fn(this.snapshot)); }
}
