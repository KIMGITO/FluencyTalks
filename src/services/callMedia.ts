// The only browser file that knows the media provider is LiveKit. The call screen talks to this, so the provider
// can be swapped without touching the UI. Imported only by the call page, which is loaded on its own, so the SDK
// never reaches other pages. Nothing here is recorded or stored.
import {
  AudioPresets, ConnectionState, createLocalAudioTrack, createLocalVideoTrack, DisconnectReason, LocalAudioTrack, LocalVideoTrack,
  Room, RoomEvent, Track, VideoPresets, type Participant,
} from 'livekit-client';
import type { MediaState } from '@/lib/callState';

/** Something a <video> or <audio> element can show, without exposing the provider's track type. */
export interface MediaRef { attach(el: HTMLMediaElement): void; detach(el: HTMLMediaElement): void }
export interface PersonMedia {
  id: string; video: MediaRef | null; audio: MediaRef | null; micOn: boolean; camOn: boolean; speaking: boolean;
  /** How loud they are right now, 0 to 1. Read it each frame; it is not part of the snapshot. */
  level: () => number;
}
export type Facing = 'user' | 'environment';
/** A line typed during the call. Sent straight to the other person over the call connection; never stored. */
export interface CallNote { id: string; mine: boolean; text: string; at: number }
export const NOTE_MAX = 500;
export interface MediaSnapshot {
  state: MediaState; local: PersonMedia; remotes: PersonMedia[];
  /** The browser blocked sound until a tap (autoplay rules). */
  needsAudioTap: boolean;
  /** Why the connection ended: the other side closed it, we left, or it was lost. */
  ended: 'closed' | 'left' | 'lost' | null;
  deviceError: string | null;
  /** Which way the camera faces. Only phones and tablets can turn it. */
  facing: Facing;
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
// 720p at 24 frames is plenty for a face, and leaves room on a slow line. Simulcast sends 180p and 360p copies
// too, so a small tile or a weak connection gets a smaller picture instead of a frozen one.
const CAPTURE = { resolution: { ...VideoPresets.h720.resolution, frameRate: 24 } };

export class Preview {
  audio: LocalAudioTrack | null = null;
  video: LocalVideoTrack | null = null;
  facing: Facing = 'user';
  async start(want: { audio: boolean; video: boolean; audioId?: string; videoId?: string }) {
    const errors: { camera?: unknown; microphone?: unknown } = {};
    if (want.audio && !this.audio) {
      try { this.audio = await createLocalAudioTrack({ deviceId: want.audioId, echoCancellation: true, noiseSuppression: true }); }
      catch (e) { errors.microphone = e; }
    }
    if (want.video && !this.video) {
      try { this.video = await createLocalVideoTrack({ ...CAPTURE, ...(want.videoId ? { deviceId: want.videoId } : { facingMode: this.facing }) }); }
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
    await (kind === 'audioinput' ? this.audio : this.video)?.restartTrack(kind === 'videoinput' ? { ...CAPTURE, deviceId: id } : { deviceId: id });
  }
  /** Front to back camera, or back to front. */
  async flip() {
    const next: Facing = this.facing === 'user' ? 'environment' : 'user';
    if (this.video) await this.video.restartTrack({ ...CAPTURE, facingMode: next });
    this.facing = next;
  }
  videoRef = () => ref(this.video);
  /** Hands the tracks to the call, or stops them. Either way this preview no longer owns them. */
  take() { const t = { audio: this.audio, video: this.video, facing: this.facing }; this.audio = null; this.video = null; return t; }
  stop() { this.audio?.stop(); this.video?.stop(); this.audio = null; this.video = null; }
}

export const listDevices = (kind: DeviceKind) => Room.getLocalDevices(kind, false).catch(() => [] as MediaDeviceInfo[]);
/** More than one camera, so there is something to switch to. */
export const canFlipCamera = () => listDevices('videoinput').then((d) => d.length > 1);

const NOTES = 'note';
/** The conversation topic someone picked during a call, by its number. Both sides show it. */
const TOPIC = 'topic';
/** Each side's level and languages, so topics can be held to the lower level of the two. Nothing is stored. */
const LEVEL = 'level';
export type CallLevel = { band: string | null; learning: string | null; native: string | null };
const enc = new TextEncoder(); const dec = new TextDecoder();

export class CallMedia {
  private room = new Room({
    // Only the size each video is shown at is downloaded, and nothing for a hidden tab. Layers nobody is
    // watching aren't sent at all (dynacast).
    adaptiveStream: { pixelDensity: 'screen' }, dynacast: true, disconnectOnPageLeave: true,
    videoCaptureDefaults: CAPTURE,
    publishDefaults: {
      simulcast: true, videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
      videoEncoding: { maxBitrate: 1_500_000, maxFramerate: 24 }, degradationPreference: 'balanced',
      // Speech settings: silence costs almost nothing (dtx), and a lost packet is covered by the next one (red).
      audioPreset: AudioPresets.speech, dtx: true, red: true,
    },
    audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  private noteListeners = new Set<(n: CallNote) => void>();
  private topicListeners = new Set<(no: number) => void>();
  private levelListeners = new Set<(l: CallLevel) => void>();
  private facing: Facing = 'user';
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
    r.on(RoomEvent.DataReceived, (payload, from, _kind, topic) => {
      if (topic === LEVEL && from) {
        try {
          const m = JSON.parse(dec.decode(payload)) as Record<string, unknown>;
          const str = (v: unknown) => (typeof v === 'string' && v.length <= 20 ? v : null);
          const l: CallLevel = { band: str(m.band), learning: str(m.learning), native: str(m.native) };
          this.levelListeners.forEach((fn) => fn(l));
        } catch { /* not a level */ }
        return;
      }
      if (topic === TOPIC && from) {
        try { const m = JSON.parse(dec.decode(payload)) as { no?: unknown }; if (typeof m.no === 'number' && Number.isInteger(m.no) && m.no > 0) this.topicListeners.forEach((fn) => fn(m.no as number)); } catch { /* not a topic */ }
        return;
      }
      if (topic !== NOTES || !from) return;
      try {
        const m = JSON.parse(dec.decode(payload)) as { id?: unknown; text?: unknown };
        if (typeof m.id !== 'string' || typeof m.text !== 'string' || !m.text.trim()) return;
        const note: CallNote = { id: m.id.slice(0, 40), mine: false, text: m.text.slice(0, NOTE_MAX), at: Date.now() };
        this.noteListeners.forEach((fn) => fn(note));
      } catch { /* not a note */ }
    });
  }

  onNote(fn: (n: CallNote) => void) { this.noteListeners.add(fn); return () => { this.noteListeners.delete(fn); }; }
  onLevel(fn: (l: CallLevel) => void) { this.levelListeners.add(fn); return () => { this.levelListeners.delete(fn); }; }
  async sendLevel(l: CallLevel) {
    await this.room.localParticipant.publishData(enc.encode(JSON.stringify(l)), { reliable: true, topic: LEVEL });
  }
  onTopic(fn: (no: number) => void) { this.topicListeners.add(fn); return () => { this.topicListeners.delete(fn); }; }
  /** Tells the other side which topic is on. Nothing is stored. */
  async sendTopic(no: number) {
    await this.room.localParticipant.publishData(enc.encode(JSON.stringify({ no })), { reliable: true, topic: TOPIC });
  }
  /** Sends a line to everyone in the call. Resolves with the note as sent, or throws if it couldn't go. */
  async sendNote(text: string): Promise<CallNote> {
    const note: CallNote = { id: crypto.randomUUID(), mine: true, text: text.trim().slice(0, NOTE_MAX), at: Date.now() };
    await this.room.localParticipant.publishData(enc.encode(JSON.stringify({ id: note.id, text: note.text })), { reliable: true, topic: NOTES });
    return note;
  }

  subscribe(fn: (s: MediaSnapshot) => void) { this.listeners.add(fn); fn(this.snapshot); return () => { this.listeners.delete(fn); }; }

  async connect(url: string, token: string, tracks: { audio: LocalAudioTrack | null; video: LocalVideoTrack | null; facing?: Facing }) {
    this.facing = tracks.facing ?? 'user';
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
        try { await this.room.localParticipant.publishTrack(t); this.emit(); return; }
        catch { await new Promise((r) => setTimeout(r, 1000)); }
      }
      t.stop();
      if (!this.left) { this.deviceError = `Your ${what} couldn't be shared. Turn it off and on to try again.`; this.emit(); }
    };
    await Promise.all([tracks.audio && publish(tracks.audio, 'microphone'), tracks.video && publish(tracks.video, 'camera')]);
  }

  async setMic(on: boolean) { this.deviceError = null; await this.room.localParticipant.setMicrophoneEnabled(on); this.emit(); }
  async setCamera(on: boolean) {
    this.deviceError = null;
    const pub = await this.room.localParticipant.setCameraEnabled(on, { ...CAPTURE, facingMode: this.facing });
    // Turned the other way while it was off: a camera coming back on restarts as it was, so point it now.
    if (on && this.flippedWhileOff) { this.flippedWhileOff = false; await (pub?.track as LocalVideoTrack | undefined)?.restartTrack({ ...CAPTURE, facingMode: this.facing }); }
    this.emit();
  }
  private flippedWhileOff = false;
  async switchDevice(kind: DeviceKind, id: string) { await this.room.switchActiveDevice(kind, id); this.emit(); }
  /** Front to back camera, or back to front. A camera that is off turns on facing the new way. */
  async flip() {
    const next: Facing = this.facing === 'user' ? 'environment' : 'user';
    const cam = this.room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined;
    const live = !!cam && !this.room.localParticipant.getTrackPublication(Track.Source.Camera)?.isMuted;
    if (live) await cam!.restartTrack({ ...CAPTURE, facingMode: next }); else this.flippedWhileOff = !this.flippedWhileOff;
    this.facing = next; this.emit();
  }
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
      level: () => (mic && !mic.isMuted ? p.audioLevel : 0),
    };
  }
  private build(): MediaSnapshot {
    const r = this.room;
    return {
      state: this.state, ended: this.ended, deviceError: this.deviceError, facing: this.facing,
      local: this.person(r.localParticipant, true),
      remotes: [...r.remoteParticipants.values()].map((p) => this.person(p, false)),
      needsAudioTap: this.state === 'connected' && !r.canPlaybackAudio,
    };
  }
  private emit() { this.snapshot = this.build(); this.listeners.forEach((fn) => fn(this.snapshot)); }
}
