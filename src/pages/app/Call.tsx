// The call screen: device preview, ringing, answering, the call itself, and how it ended. Loaded on its own route,
// so the media SDK only downloads when someone actually calls. /call/new?to=<user> starts a call; /call/<id> is one.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Mic, MicOff, Phone, PhoneOff, RefreshCw, Settings2, Video, VideoOff, Volume2, WifiOff } from 'lucide-react';
import { Avatar, Button, Modal, Select, Spinner, FormError } from '@/components/ui';
import { ControlButton, VideoTile } from '@/components/features/call/CallParts';
import { callControl, getCall, getCallPeer, getCallToken, reportCallConnected, respondCallInvite, startCall, subscribeToMyCalls } from '@/services/calls';
import { CallMedia, listDevices, Preview, type DeviceKind, type MediaSnapshot } from '@/services/callMedia';
import { getTopicCall, startTopicCall, type TopicCall } from '@/services/path';
import { callVoiceOnlyWith } from '@/services/age';
import { callPhase, deviceErrorText, endedText, formatDuration, isLive, others, type CallInfo, type CallPhase } from '@/lib/callState';
import { userMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/authStore';
import { useOnline } from '@/hooks/useOnline';

type PeerHint = { name?: string | null; avatar?: string | null } | null;

export default function CallPage() {
  const { id = '' } = useParams(); const [params] = useSearchParams(); const nav = useNavigate(); const hint = useLocation().state as PeerHint;
  const myId = useAuthStore((s) => s.user?.id);
  const online = useOnline();
  const isNew = id === 'new'; const to = params.get('to'); const topicMode = params.get('topic') === '1';
  const [topic, setTopic] = useState<TopicCall | null>(null);
  const [topicOpen, setTopicOpen] = useState(true);

  const [call, setCall] = useState<CallInfo | null>(null);
  const [loadError, setLoadError] = useState('');
  const [snap, setSnap] = useState<MediaSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mic, setMic] = useState(true); const [cam, setCam] = useState(true);
  const [deviceErrors, setDeviceErrors] = useState<{ camera?: string; microphone?: string }>({});
  const [previewVideo, setPreviewVideo] = useState<ReturnType<Preview['videoRef']>>(null);
  const [settings, setSettings] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [peer, setPeer] = useState<PeerHint>(hint);
  useEffect(() => { if (isNew && to && !hint?.name) getCallPeer(to).then((p) => p && setPeer({ name: p.display_name || p.username, avatar: p.avatar_url })).catch(() => undefined); }, [isNew, to, hint?.name]);
  const preview = useRef(new Preview()); const media = useRef<CallMedia | null>(null);
  const previewStarted = useRef(false); const previewReady = useRef<Promise<unknown>>(Promise.resolve()); const alive = useRef(true); const callId = useRef(isNew ? '' : id);

  const refresh = useCallback(async () => {
    const cid = callId.current; if (!cid) return;
    try { setCall(await getCall(cid)); setLoadError(''); } catch (e) { setLoadError(userMessage(e)); }
  }, []);

  useEffect(() => { if (!isNew) { callId.current = id; void refresh(); } }, [id, isNew, refresh]);
  useEffect(() => subscribeToMyCalls(() => { void refresh(); }), [refresh]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const remotes = snap?.remotes.length ?? 0;
  const phase: CallPhase = loadError && !call ? 'failed'
    : isNew ? (busy ? 'connecting' : 'preview') : callPhase(call, myId, snap?.state ?? 'idle', remotes);
  const other = others(call, myId)[0];
  const name = other?.display_name || other?.username || peer?.name || 'your partner';
  const avatar = other?.avatar_url ?? peer?.avatar ?? null;

  // A call with a member under 16 is sound only. The media token enforces it; this only keeps the camera off
  // screen. Asked before the preview starts, so the camera never turns on. Unknown counts as voice only.
  const otherId = isNew ? to : other?.user_id;
  const [voiceOnly, setVoiceOnly] = useState<boolean | null>(null);
  useEffect(() => {
    if (!otherId) return;
    let live = true;
    callVoiceOnlyWith(otherId).then((v) => { if (live) setVoiceOnly(v !== false); }).catch(() => { if (live) setVoiceOnly(true); });
    return () => { live = false; };
  }, [otherId]);
  useEffect(() => { if (voiceOnly) setCam(false); }, [voiceOnly]);

  // Unanswered: ask the server again just after the ring time runs out, so both sides see it end.
  const ringEnd = call?.status === 'ringing' ? Date.parse(call.ring_expires_at) : 0;
  useEffect(() => { if (ringEnd && now > ringEnd + 1500 && now < ringEnd + 2600) void refresh(); }, [now, ringEnd, refresh]);

  // Camera and microphone start only on this screen, which someone opened by tapping Call or Answer.
  const wantsPreview = (phase === 'preview' || phase === 'incoming') && voiceOnly !== null;
  useEffect(() => {
    if (!wantsPreview || previewStarted.current || media.current) return;
    previewStarted.current = true;
    previewReady.current = preview.current.start({ audio: true, video: !voiceOnly }).then((errs) => {
      setDeviceErrors({ camera: errs.camera ? deviceErrorText(errs.camera, 'camera') : undefined, microphone: errs.microphone ? deviceErrorText(errs.microphone, 'microphone') : undefined });
      if (errs.camera) setCam(false); if (errs.microphone) setMic(false);
      setPreviewVideo(preview.current.videoRef());
    });
  }, [wantsPreview, voiceOnly]);

  const stopEverything = useCallback(() => { preview.current.stop(); setPreviewVideo(null); void media.current?.leave(); }, []);

  // Leaving this screen hangs up. Deferred a tick, because development mode mounts components twice.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      setTimeout(() => {
        if (alive.current) return;
        const joined = !!media.current;
        stopEverything();
        if (joined && callId.current) void callControl(callId.current, 'leave').catch(() => undefined);
      }, 0);
    };
  }, [stopEverything]);

  // The call ended on the server, or the room was closed: stop the media here too.
  useEffect(() => { if (call && !isLive(call.status)) stopEverything(); }, [call?.status, stopEverything]);
  useEffect(() => { if (snap?.ended === 'closed') void refresh(); }, [snap?.ended, refresh]);

  const join = async (cid: string) => {
    const { token, url, voice_only } = await getCallToken(cid);
    await previewReady.current;   // a tap before the camera finished starting must not leave it running
    if (voice_only) { setVoiceOnly(true); setCam(false); await preview.current.setVideo(false); }
    const m = new CallMedia(); media.current = m; m.subscribe(setSnap);
    const tracks = preview.current.take(); setPreviewVideo(null);
    if (tracks.audio && !mic) await tracks.audio.mute(); if (tracks.video && !cam) await tracks.video.mute();
    await m.connect(url, token, tracks);
    reportCallConnected(cid).catch(() => undefined);
    void refresh();
  };
  const act = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(userMessage(e)); } finally { setBusy(false); }
  };
  const begin = () => act(async () => {
    if (!to) throw new Error('missing');
    const cid = topicMode ? await startTopicCall(to) : await startCall(to); callId.current = cid;
    nav(`/call/${cid}`, { replace: true, state: peer });
    await refresh(); await join(cid);
  });
  const answer = () => act(async () => { await respondCallInvite(id, true); await refresh(); await join(id); });
  const decline = () => act(async () => { stopEverything(); await respondCallInvite(id, false); await refresh(); });
  const rejoin = () => act(async () => {
    media.current = null; setSnap(null);
    if (!preview.current.audio && !preview.current.video) await preview.current.start({ audio: mic, video: cam });
    await join(id);
  });
  const hangUp = () => act(async () => {
    const cid = callId.current; stopEverything();
    if (cid) await callControl(cid, 'leave'); await refresh();
  });

  const toggleMic = async () => {
    const next = !mic; setMic(next);
    try {
      if (media.current && snap?.state === 'connected') await media.current.setMic(next);
      else if (next) { const e = await preview.current.setAudio(true); if (e) { setMic(false); setDeviceErrors((d) => ({ ...d, microphone: deviceErrorText(e, 'microphone') })); } }
      else await preview.current.setAudio(false);
    } catch (e) { setMic(!next); setDeviceErrors((d) => ({ ...d, microphone: deviceErrorText(e, 'microphone') })); }
  };
  const toggleCam = async () => {
    if (voiceOnly) return;
    const next = !cam; setCam(next);
    try {
      if (media.current && snap?.state === 'connected') await media.current.setCamera(next);
      else { const e = await preview.current.setVideo(next); if (e) { setCam(false); setDeviceErrors((d) => ({ ...d, camera: deviceErrorText(e, 'camera') })); } setPreviewVideo(preview.current.videoRef()); }
    } catch (e) { setCam(!next); setDeviceErrors((d) => ({ ...d, camera: deviceErrorText(e, 'camera') })); }
  };

  const status = (() => {
    switch (phase) {
      case 'loading': return 'Loading…';
      case 'preview': return isNew ? `Ready to call ${name}` : snap?.ended === 'lost' ? 'Connection lost' : `You're in a call with ${name}`;
      case 'incoming': return `${name} is calling you`;
      case 'connecting': return 'Connecting…';
      case 'ringing': return `Calling ${name}…`;
      case 'waiting': return `Waiting for ${name} to join…`;
      case 'active': return call?.started_at ? formatDuration((now - Date.parse(call.started_at)) / 1000) : 'Connected';
      case 'reconnecting': return 'Reconnecting…';
      case 'failed': return "Couldn't connect";
      default: return '';
    }
  })();

  // Topic calls carry their prompts, and after they end the partner is asked to assess.
  useEffect(() => {
    if (isNew || !id) return;
    let live = true;
    getTopicCall(id).then((t) => { if (live) setTopic(t); }).catch(() => undefined);
    return () => { live = false; };
  }, [id, isNew, call?.status]);

  if (phase === 'ended' && call) {
    const t = endedText(call, myId, name);
    const canRetry = !!other?.user_id;
    return (
      <Screen>
        <div className="m-auto flex max-w-sm flex-col items-center gap-3 px-4 text-center">
          <Avatar name={name} src={avatar} size="xl" />
          <h1 className="font-display text-2xl">{t.title}</h1>
          {t.detail && <p className="text-on-deep/80">{t.detail}</p>}
          {topic && <TopicEnded topic={topic} name={name} onAssess={() => nav(`/path/assess/${id}`)} />}
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {canRetry && <Button onClick={() => nav(`/call/new?to=${other.user_id}`, { state: { name, avatar } })}><Phone size={18} />{call.initiated_by === myId ? 'Call again' : 'Call back'}</Button>}
            <Button variant="secondary" className="border-on-deep/40 bg-transparent text-on-deep" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/messages'))}>Back</Button>
          </div>
        </div>
      </Screen>
    );
  }

  const inCall = phase === 'active' || phase === 'ringing' || phase === 'waiting' || phase === 'reconnecting' || phase === 'connecting';
  const remote = snap?.remotes[0];
  const localVideo = media.current ? snap?.local.video ?? null : previewVideo;
  const micOn = media.current && snap?.state === 'connected' ? !!snap.local.micOn : mic;
  const camOn = media.current && snap?.state === 'connected' ? !!snap.local.camOn : cam && !!previewVideo;

  return (
    <Screen>
      <header className="flex items-center gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <Avatar name={name} src={avatar} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-xs text-on-deep/80" aria-live="polite">{status}</p>
        </div>
        {!online && <span className="flex items-center gap-1 text-xs text-on-deep/80"><WifiOff size={14} />Offline</span>}
      </header>

      <main className="relative min-h-0 flex-1 px-2 sm:px-4">
        {phase === 'loading' && <div className="flex h-full items-center justify-center"><Spinner /></div>}
        {phase !== 'loading' && (
          <div className="relative h-full overflow-hidden rounded-md">
            {inCall && remote
              ? <VideoTile video={remote.video} audio={remote.audio} name={name} avatar={avatar} micOn={remote.micOn} speaking={remote.speaking} />
              : (inCall
                ? <div className="flex h-full flex-col items-center justify-center gap-4"><Avatar name={name} src={avatar} size="xl" />{phase !== 'active' && <Spinner />}</div>
                : <VideoTile video={localVideo} name="You" mirrored label={voiceOnly ? "You" : "Your camera preview"} micOn={micOn} />)}
            {inCall && (
              <div className="absolute bottom-3 right-3"><VideoTile small video={localVideo} name="You" mirrored micOn={micOn} label={voiceOnly ? "You" : "Your camera"} /></div>)}
          </div>)}
      </main>

      <section className="space-y-3 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3">
        {topic && inCall && (
          <div className="rounded-md border-l-4 border-accent bg-on-deep/10 p-3 text-sm">
            <button type="button" className="flex w-full items-center justify-between gap-2 text-left" aria-expanded={topicOpen} onClick={() => setTopicOpen(!topicOpen)}>
              <span className="font-display text-lg uppercase italic">Topic {topic.topic} · {topic.title}</span><span className="text-xs text-on-deep/80">{topicOpen ? 'Hide' : 'Show'}</span>
            </button>
            {topicOpen && <ol className="mt-2 list-decimal space-y-1 pl-5 text-on-deep/90">{topic.prompts.map((p) => <li key={p}>{p}</li>)}</ol>}
          </div>)}
        {(deviceErrors.camera || deviceErrors.microphone) && !inCall && (
          <div role="status" className="space-y-1 rounded-md bg-on-deep/10 p-3 text-sm">
            {deviceErrors.microphone && <p>{deviceErrors.microphone}</p>}
            {deviceErrors.camera && <p>{deviceErrors.camera}{!deviceErrors.microphone && ' You can still talk with sound only.'}</p>}
          </div>)}
        {(phase === 'preview' || phase === 'incoming') && !deviceErrors.camera && !deviceErrors.microphone && (
          <p className="text-center text-xs text-on-deep/80">{voiceOnly
            ? 'Voice call: cameras stay off because a member under 16 is on this call. Nothing is recorded.'
            : 'Your camera and microphone are used only for this call. Nothing is recorded.'}</p>)}
        {phase === 'preview' && snap?.ended === 'lost' && <p role="alert" className="text-center text-sm">Your connection dropped. Rejoin when you're back online.</p>}
        {phase === 'failed' && <p role="alert" className="text-center text-sm">{loadError || 'The call could not connect. Check your connection and try again.'}</p>}
        {snap?.needsAudioTap && (
          <div className="flex justify-center"><Button size="sm" onClick={() => void media.current?.startAudio()}><Volume2 size={16} />Tap to hear {name}</Button></div>)}
        {inCall && snap?.deviceError && <p role="status" className="text-center text-sm">{snap.deviceError}</p>}
        {error && <p role="alert" className="text-center text-sm">{error}</p>}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <ControlButton label={micOn ? 'Turn microphone off' : 'Turn microphone on'} pressed={micOn} onClick={() => void toggleMic()}>{micOn ? <Mic size={22} /> : <MicOff size={22} />}</ControlButton>
          {!voiceOnly && <ControlButton label={camOn ? 'Turn camera off' : 'Turn camera on'} pressed={camOn} onClick={() => void toggleCam()}>{camOn ? <Video size={22} /> : <VideoOff size={22} />}</ControlButton>}
          <ControlButton label={voiceOnly ? 'Microphone and speaker settings' : 'Camera and microphone settings'} onClick={() => setSettings(true)}><Settings2 size={22} /></ControlButton>
          {phase === 'incoming' && <>
            <ControlButton label="Decline" danger disabled={busy} onClick={() => void decline()}><PhoneOff size={22} /></ControlButton>
            <ControlButton label="Answer" primary disabled={busy} onClick={() => void answer()}><Phone size={22} /></ControlButton></>}
          {phase === 'preview' && (isNew
            ? <ControlButton label={`Call ${name}`} primary disabled={busy || !to} onClick={() => void begin()}><Phone size={22} /></ControlButton>
            : <>
              <ControlButton label="Hang up" danger disabled={busy} onClick={() => void hangUp()}><PhoneOff size={22} /></ControlButton>
              <ControlButton label="Rejoin the call" primary disabled={busy} onClick={() => void rejoin()}><RefreshCw size={22} /></ControlButton></>)}
          {phase === 'failed' && !isNew && call && <ControlButton label="Try again" primary disabled={busy} onClick={() => void rejoin()}><RefreshCw size={22} /></ControlButton>}
          {(inCall || phase === 'failed') && <ControlButton label={phase === 'ringing' ? 'Cancel call' : 'Hang up'} danger disabled={busy} onClick={() => void hangUp()}><PhoneOff size={22} /></ControlButton>}
          {phase === 'failed' && isNew && <Button variant="secondary" onClick={() => nav(-1)}>Back</Button>}
        </div>
      </section>

      <DeviceSettings open={settings} voiceOnly={!!voiceOnly} onClose={() => setSettings(false)}
        onPick={async (kind, deviceId) => {
          if (media.current && snap?.state === 'connected') await media.current.switchDevice(kind, deviceId);
          else if (kind !== 'audiooutput') { await preview.current.switchDevice(kind, deviceId); setPreviewVideo(preview.current.videoRef()); }
        }} />
    </Screen>
  );
}

/** Full screen and modal: rendered outside the app, which is made inert so keyboard focus can't wander behind it. */
function Screen({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.getElementById('root'); if (!root) return;
    root.inert = true; return () => { root.inert = false; };
  }, []);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Call" className="fixed inset-0 z-[60] flex flex-col bg-deep text-on-deep">{children}</div>,
    document.body);
}

function DeviceSettings({ open, voiceOnly, onClose, onPick }: { open: boolean; voiceOnly: boolean; onClose: () => void; onPick: (kind: DeviceKind, id: string) => Promise<void> }) {
  const [devices, setDevices] = useState<Record<DeviceKind, MediaDeviceInfo[]>>({ audioinput: [], videoinput: [], audiooutput: [] });
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    Promise.all((['audioinput', 'videoinput', 'audiooutput'] as const).map(listDevices))
      .then(([audioinput, videoinput, audiooutput]) => setDevices({ audioinput, videoinput, audiooutput }));
  }, [open]);
  const pick = (kind: DeviceKind) => (e: React.ChangeEvent<HTMLSelectElement>) => { setError(''); onPick(kind, e.target.value).catch((err) => setError(deviceErrorText(err, kind === 'videoinput' ? 'camera' : 'microphone'))); };
  const rows = ([['audioinput', 'Microphone'], ['videoinput', 'Camera'], ['audiooutput', 'Speaker']] as [DeviceKind, string][])
    .filter(([k]) => !voiceOnly || k !== 'videoinput');
  return (
    <Modal open={open} onClose={onClose} title={voiceOnly ? 'Microphone and speaker' : 'Camera and microphone'}>
      <div className="space-y-3">
        {rows.filter(([k]) => devices[k].length).map(([kind, label]) => (
          <Select key={kind} label={label} onChange={pick(kind)} defaultValue="">
            <option value="" disabled>Choose a {label.toLowerCase()}</option>
            {devices[kind].map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `${label} ${i + 1}`}</option>)}
          </Select>))}
        {!devices.audioinput.length && !devices.videoinput.length && <p className="text-sm text-muted">No camera or microphone found. Your browser may need permission first.</p>}
        <FormError>{error}</FormError>
      </div>
    </Modal>
  );
}

function TopicEnded({ topic, name, onAssess }: { topic: TopicCall; name: string; onAssess: () => void }) {
  const short = topic.minutes < topic.min_minutes;
  if (topic.i_am === 'partner') {
    if (!topic.assess_blocker) return <div className="mt-2 space-y-2"><p className="text-sm text-on-deep/90">This was {name}'s topic call: “{topic.title}”. Your scores help them move on.</p><Button onClick={onAssess}>Assess {name}</Button></div>;
    if (topic.assess_blocker === 'too_short') return <p className="text-sm text-on-deep/80">You talked {Math.round(topic.minutes)} minutes. A topic call needs {topic.min_minutes} minutes together to be assessed.</p>;
    return null;
  }
  return <p className="text-sm text-on-deep/80">{short
    ? `You talked ${Math.round(topic.minutes)} minutes. A topic call needs ${topic.min_minutes} minutes together to count, so try again.`
    : `${name} has been asked to assess your topic call. You'll see the result on your path.`}</p>;
}
