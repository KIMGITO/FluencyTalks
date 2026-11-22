// The call screen: device preview, ringing, answering, the call itself, and how it ended. Loaded on its own route,
// so the media SDK only downloads when someone actually calls. /call/new?to=<user> starts a call; /call/<id> is one.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { useLocation, useNavigate, useNavigationType, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Clock, History, MessageCircle, MessageSquare, PhoneMissed, PhoneOff, X, Mic, MicOff, Phone, RefreshCw, Settings2, SwitchCamera, Video, VideoOff, Volume2, WifiOff } from 'lucide-react';
import { Avatar, Button, Card, Modal, Spinner } from '@/components/ui';
import { CallChat, CallStage, ControlButton, Dots, HangUpIcon, LayoutPicker, layoutFrom, VideoTile, type CallLayout, type Corner } from '@/components/features/call/CallParts';
import { callControl, getCall, getCallPeer, getCallToken, reportCallConnected, reportCallRinging, respondCallInvite, startCall, subscribeToMyCalls } from '@/services/calls';
import { CallMedia, canFlipCamera, Preview, type CallLevel, type CallNote, type Facing, type MediaSnapshot } from '@/services/callMedia';
import { CallVote, DeviceMenu, TopicStrip, type ShownTopic } from '@/components/features/call/CallTopic';
import { TopicPicker } from '@/components/features/call/TopicPicker';
import { AssessForm } from '@/components/features/call/AssessForm';
import { useProfileStore } from '@/store/profileStore';
import { resolveAvatar, useProviderAvatar } from '@/lib/avatar';
import { ring } from '@/lib/ringtone';
import { BANDS, getTopicCall, listTopics, startTopicCall, type Band, type Topic, type TopicCall } from '@/services/path';
import { callVoiceOnlyWith } from '@/services/age';
import { callPhase, deviceErrorText, endedText, formatDuration, isLive, me as myPart, others, type CallInfo, type CallPhase } from '@/lib/callState';
import { userMessage, UserError } from '@/lib/errors';
import { startConversation } from '@/services/messaging';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useOnline } from '@/hooks/useOnline';

/** From the banner or chat: who it is, and `answer` when they already tapped Answer. */
type PeerHint = { name?: string | null; avatar?: string | null; answer?: boolean } | null;

// The chosen layout and corner are remembered on this device.
const LAYOUT_KEY = 'ft.call.layout';
const remembered = (): { layout: CallLayout; corner: Corner } => {
  try { const v = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? 'null'); if (v?.layout && v?.corner) return { layout: layoutFrom(v.layout), corner: v.corner }; } catch { /* none */ }
  return { layout: 'them', corner: 'br' };
};

/** A mouse or trackpad as the main pointer: a laptop or desktop, where several cameras and speakers are common. */
const PICK_DEVICES = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * One route serves every call, so React would keep the old call's state ("ended") when "Call again" moves to
 * /call/new. A fresh screen for each call, except the move (a replace) from /call/new to the id it just created.
 */
export default function CallPage() {
  const { id = '' } = useParams(); const how = useNavigationType();
  const gen = useRef(0); const prev = useRef(id);
  // The screen's own move is a replace; answering another call from the incoming banner is a push, so it starts fresh.
  if (id !== prev.current) { if (prev.current !== 'new' || how !== 'REPLACE') gen.current += 1; prev.current = id; }
  return <CallScreen key={gen.current} />;
}

function CallScreen() {
  const { id = '' } = useParams(); const [params] = useSearchParams(); const nav = useNavigate(); const loc = useLocation(); const hint = loc.state as PeerHint;
  // Somewhere in the app to go back to (not opened straight from a link or a notification).
  const canGoBack = loc.key !== 'default';
  const myId = useAuthStore((s) => s.user?.id);
  const online = useOnline();
  const isNew = id === 'new'; const to = params.get('to');
  // ?topic=<number> starts a rated topic call about that topic; ?topic=1 from older links lets the server pick one.
  const topicParam = params.get('topic'); const topicMode = topicParam != null; const topicNo = topicParam && topicParam !== '1' ? Number(topicParam) || null : null;
  const [topic, setTopic] = useState<TopicCall | null>(null);
  // On an ordinary call, the topic one of us picked; both sides see it.
  const [chosen, setChosen] = useState<Topic | null>(null);
  const [picking, setPicking] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [rated, setRated] = useState(false);
  // My own tile shows my photo, or my initials, when my camera is off: never initials made from "You".
  const meProfile = useProfileStore((s) => s.me);
  const providerAvatar = useProviderAvatar();
  const myName = meProfile?.display_name || meProfile?.username || 'You';
  const myAvatar = resolveAvatar(meProfile?.avatar_url, providerAvatar);
  const level = useProfileStore((s) => (s.me?.verified_level ?? s.me?.learning_level ?? null) as Band | null);
  const myLearning = meProfile?.learning_language_id ?? null; const myNative = meProfile?.native_language_id ?? null;
  // The partner's level, sent over the call.
  const [partnerLevel, setPartnerLevel] = useState<CallLevel | null>(null);

  const [call, setCall] = useState<CallInfo | null>(null);
  // Whoever calls is the one who wants to learn, so the conversation is built on the caller's level. When the other
  // person is a perfect match (a native speaker of the caller's learning language, or at the caller's level or above
  // in it) the topics are simply the caller's level, with no level to choose. Otherwise topics never go past the
  // lower of the two levels: with an A1 partner, only A1 topics.
  const topicLevel = ((): { band: Band | null; max: Band | null } => {
    const isBand = (b: unknown): b is Band => BANDS.includes(b as Band);
    const mine: CallLevel = { band: level, learning: myLearning, native: myNative };
    const iCalled = isNew || (!!call && call.initiated_by === myId);
    const learner = iCalled ? mine : partnerLevel; const helper = iCalled ? partnerLevel : mine;
    if (!learner || !isBand(learner.band)) return { band: null, max: null };
    if (!helper) return { band: learner.band, max: learner.band };
    const sameLanguage = !!learner.learning && helper.learning === learner.learning;
    const native = !!helper.native && helper.native === learner.learning;
    if (native || (sameLanguage && isBand(helper.band) && BANDS.indexOf(helper.band) >= BANDS.indexOf(learner.band))) return { band: learner.band, max: learner.band };
    const max = isBand(helper.band) && BANDS.indexOf(helper.band) < BANDS.indexOf(learner.band) ? helper.band : learner.band;
    return { band: null, max };
  })();
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
  const [view, setView] = useState(remembered);
  const arrange = (next: Partial<typeof view>) => setView((v) => { const n = { ...v, ...next }; try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(n)); } catch { /* fine */ } return n; });
  const [canFlip, setCanFlip] = useState(false);
  const [facing, setFacing] = useState<Facing>('user');
  const [notes, setNotes] = useState<CallNote[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  // Tap the video (or the arrow) to hide the call buttons and see more; tap again to bring them back.
  const [controlsHidden, setControlsHidden] = useState(false);
  // Height of the bottom bar, so the videos end above it and their name tags never sit under the buttons.
  const bar = useRef<HTMLElement>(null); const [barH, setBarH] = useState(0);
  useEffect(() => {
    const el = bar.current; if (!el) return;
    const ro = new ResizeObserver(() => setBarH(el.offsetHeight)); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [unread, setUnread] = useState(0);
  const [peek, setPeek] = useState<CallNote | null>(null);
  const chatOpenRef = useRef(false); chatOpenRef.current = chatOpen;
  const autoAnswered = useRef(false);
  // Answer was tapped already: in the in-app ringer, or on the phone's notification (?answer=1).
  const wantsAnswer = !!hint?.answer || params.get('answer') === '1';
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
      canFlipCamera().then(setCanFlip).catch(() => undefined);
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
    m.onNote((n) => {
      setNotes((all) => [...all, n].slice(-200));
      if (!chatOpenRef.current) { setUnread((u) => u + 1); setPeek(n); }
    });
    m.onLevel(setPartnerLevel);
    m.onTopic((no) => { listTopics().then((all) => { const t = all.find((x) => x.no === no); if (t) setChosen(t); }).catch(() => undefined); });
    const tracks = preview.current.take(); setPreviewVideo(null);
    if (tracks.audio && !mic) await tracks.audio.mute(); if (tracks.video && !cam) await tracks.video.mute();
    await m.connect(url, token, tracks);
    reportCallConnected(cid).catch(() => undefined);
    void refresh();
  };
  // What is happening right now, said on screen until it's done ("Answering…", "Ending the call…").
  const [doing, setDoing] = useState('');
  const act = async (fn: () => Promise<void>, label = '') => {
    setBusy(true); setError(''); setDoing(label);
    try { await fn(); } catch (e) { setError(userMessage(e)); } finally { setBusy(false); setDoing(''); }
  };
  const begin = () => act(async () => {
    if (!to) throw new Error('missing');
    let cid: string;
    try { cid = topicMode ? await startTopicCall(to, topicNo) : await startCall(to); }
    catch (e) {
      // Said with their name, so it's clear the call didn't go out and why.
      if (e instanceof ApiError && e.code === 'user_busy') throw new UserError(`${name} is on another call right now. Try again in a few minutes, or send a message.`);
      if (e instanceof ApiError && e.code === 'user_unavailable') throw new UserError(`${name} can't be called right now.`);
      throw e;
    }
    callId.current = cid;
    nav(`/call/${cid}`, { replace: true, state: peer });
    await refresh(); await join(cid);
  }, 'Starting the call…');
  const answer = () => act(async () => { await respondCallInvite(id, true); await refresh(); await join(id); }, 'Answering…');
  // Answered from the banner: go straight in, with the camera and microphone on, once we know if it's voice only.
  useEffect(() => {
    if (phase !== 'incoming' || !wantsAnswer || voiceOnly === null || autoAnswered.current) return;
    autoAnswered.current = true; void answer();
  }, [phase, wantsAnswer, voiceOnly]);
  // The phone rings for the person called, and the caller hears it ringing.
  // The caller hears ringing only once it really rings on the other side.
  const rang = !!other?.rang_at;
  const sound = phase === 'incoming' && !wantsAnswer ? 'incoming' : phase === 'ringing' && rang ? 'ringback' : null;
  useEffect(() => { if (phase === 'incoming' && id && !isNew) reportCallRinging(id).catch(() => undefined); }, [phase === 'incoming', id]);
  useEffect(() => (sound ? ring(sound) : undefined), [sound]);
  useEffect(() => { if (!peek) return; const t = setTimeout(() => setPeek(null), 5000); return () => clearTimeout(t); }, [peek]);

  const flip = async () => {
    try {
      if (media.current && snap?.state === 'connected') await media.current.flip();
      else { await preview.current.flip(); setPreviewVideo(preview.current.videoRef()); }
      setFacing((f) => (f === 'user' ? 'environment' : 'user'));
    } catch (e) { setDeviceErrors((d) => ({ ...d, camera: deviceErrorText(e, 'camera') })); }
  };
  const sendNote = async (text: string) => {
    const m = media.current; if (!m) throw new Error('not connected');
    const n = await m.sendNote(text); setNotes((all) => [...all, n].slice(-200));
  };
  const openChat = () => { setChatOpen(true); setUnread(0); setPeek(null); };
  const pickTopic = (t: Topic) => { setChosen(t); void media.current?.sendTopic(t.no).catch(() => undefined); };
  // Someone who joins after the topic was picked is told which one is on.
  useEffect(() => { if (remotes > 0 && chosen && media.current) void media.current.sendTopic(chosen.no).catch(() => undefined); }, [remotes > 0]);
  // Tell whoever joins our level, so both sides hold topics to the lower one.
  useEffect(() => {
    if (remotes > 0 && media.current) void media.current.sendLevel({ band: level, learning: myLearning, native: myNative }).catch(() => undefined);
  }, [remotes > 0, level, myLearning, myNative]);
  const decline = () => act(async () => { stopEverything(); await respondCallInvite(id, false); await refresh(); }, 'Declining…');
  const rejoin = () => act(async () => {
    media.current = null; setSnap(null);
    if (!preview.current.audio && !preview.current.video) await preview.current.start({ audio: mic, video: cam });
    await join(id);
  }, 'Rejoining…');
  const hangUp = () => act(async () => {
    const cid = callId.current; stopEverything();
    if (cid) await callControl(cid, 'leave'); await refresh();
  }, phase === 'ringing' ? 'Cancelling…' : 'Ending the call…');
  // A topic call under the minimum can't be rated, so ending it early asks first. Keeping on keeps the timer running.
  const minutesTogether = call?.started_at ? (now - Date.parse(call.started_at)) / 60000 : 0;
  const endTapped = () => { if (topic && phase === 'active' && minutesTogether < topic.min_minutes) setConfirmEnd(true); else void hangUp(); };

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

  const status = doing || (() => {
    switch (phase) {
      case 'loading': return 'Loading…';
      case 'preview': return isNew ? `Ready to call ${name}` : snap?.ended === 'lost' ? 'Connection lost' : `You're in a call with ${name}`;
      case 'incoming': return `${name} is calling you`;
      case 'connecting': return 'Connecting…';
      case 'ringing': return rang ? `Ringing ${name}…` : `Trying to reach ${name}…`;
      case 'waiting': return `Waiting for ${name} to join…`;
      case 'active': return call?.started_at ? formatDuration((now - Date.parse(call.started_at)) / 1000) : 'Connected';
      case 'reconnecting': return 'Reconnecting…';
      case 'failed': return "Couldn't connect";
      default: return '';
    }
  })();
  // While reaching them, the word animates: "Calling…", "Ringing…".
  const calling = phase === 'ringing' ? (rang ? 'Ringing' : 'Calling') : phase === 'connecting' ? 'Connecting' : phase === 'waiting' ? 'Waiting' : phase === 'reconnecting' ? 'Reconnecting' : null;
  const waitingText = phase === 'ringing'
    ? (rang ? 'Ringing on their device. They can answer any moment.' : `Trying to reach ${name}. Their device hasn't shown the call yet.`)
    : phase === 'waiting' ? `${name} hasn't joined yet.` : '';

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
    const talked = !!myPart(call, myId)?.joined_at && !!other?.joined_at;
    const missed = call.end_reason === 'no_answer' || (call.end_reason === 'cancelled' && call.initiated_by !== myId);
    const StatusIcon = missed ? PhoneMissed : PhoneOff;
    const length = talked && call.started_at && call.ended_at ? formatDuration((Date.parse(call.ended_at) - Date.parse(call.started_at)) / 1000) : '';
    const back = () => (canGoBack ? nav(-1) : nav('/messages', { replace: true }));
    const roundTop = 'inline-flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-full bg-on-deep/10 text-on-deep hover:bg-on-deep/20';
    return (
      <Screen>
        <header className="flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
          <button type="button" onClick={back} aria-label="Back" title="Back" className={roundTop}><ArrowLeft size={20} /></button>
          <button type="button" onClick={() => nav('/calls', { replace: true })} aria-label="Call history" title="Call history" className={roundTop}><History size={20} /></button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-sm flex-col items-center justify-center gap-4 px-4 py-6 text-center">
            {/* Their picture, with how it ended as a small red badge: ended, declined or missed. */}
            <span className="relative inline-flex" role="status" aria-live="assertive">
              <span className="rounded-full p-1 ring-2 ring-on-deep/15"><Avatar name={name} src={avatar} size="xl" /></span>
              <span className={clsx('ft-end-in absolute -bottom-0.5 -right-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full border-4 border-deep',
                'bg-danger text-white')}><StatusIcon size={18} aria-hidden /></span>
            </span>
            <div className="ft-end-in space-y-1">
              <h1 className="font-display text-3xl font-bold leading-tight text-on-deep">{name}</h1>
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger">
                {t.title}{length && <><span aria-hidden>·</span><Clock size={14} aria-hidden /><span>{length}</span></>}
              </p>
              {t.detail && !length && <p className="text-sm text-on-deep/70">{t.detail}</p>}
            </div>
            {talked && <CallVote callId={call.id} name={name} />}
            {topic && <TopicEnded topic={topic} name={name} rated={rated} onRated={() => setRated(true)} />}
          </div>
        </div>

        {/* The next step, as big round buttons like the ones in the call. */}
        <footer className="border-t border-on-deep/10 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3">
          <div className="mx-auto flex max-w-xs items-start justify-center gap-x-4">
            {canRetry && <ControlButton label={`Message ${name}`} caption="Message" disabled={busy}
              onClick={() => void act(async () => { nav(`/messages/${await startConversation(other.user_id)}`); }, 'Opening the chat…')}><MessageCircle size={22} /></ControlButton>}
            {canRetry && <ControlButton label={`Call ${name} again`} caption={call.initiated_by === myId ? 'Call again' : 'Call back'} tone="go"
              onClick={() => nav(`/call/new?to=${other.user_id}`, { state: { name, avatar } })}>{voiceOnly ? <Phone size={22} /> : <Video size={22} />}</ControlButton>}
            <ControlButton label="Close" caption="Close" onClick={back}><X size={22} /></ControlButton>
          </div>
        </footer>
      </Screen>
    );
  }

  const inCall = phase === 'active' || phase === 'ringing' || phase === 'waiting' || phase === 'reconnecting' || phase === 'connecting';
  const remote = snap?.remotes[0];
  const localVideo = media.current ? snap?.local.video ?? null : previewVideo;
  const micOn = media.current && snap?.state === 'connected' ? !!snap.local.micOn : mic;
  const camOn = media.current && snap?.state === 'connected' ? !!snap.local.camOn : cam && !!previewVideo;
  const connected = !!media.current && snap?.state === 'connected';
  const offNote = voiceOnly ? undefined : 'Camera off';
  const mine = (
    <VideoTile video={localVideo} name={myName} caption="You" avatar={myAvatar} mirrored={facing === 'user'} label={voiceOnly ? 'You' : 'Your camera'} micOn={micOn}
      speaking={snap?.local.speaking} level={snap?.local.level} cameraNote={offNote} />);
  const theirs = remote
    ? <VideoTile video={remote.video} audio={remote.audio} name={name} avatar={avatar} micOn={remote.micOn} speaking={remote.speaking} level={remote.level}
        cameraNote={voiceOnly ? undefined : `${name}'s camera is off`} />
    : (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-md bg-on-deep/5">
        <span className="relative inline-flex">
          {phase === 'ringing' && rang && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-go/40" />}
          <span className={phase === 'ringing' && !rang ? 'animate-pulse' : undefined}><Avatar name={name} src={avatar} size="xl" /></span>
        </span>
        {calling && <p className="font-display text-2xl font-semibold text-on-deep"><Dots>{calling}</Dots></p>}
        {waitingText && <p className="max-w-xs px-4 text-center text-sm text-on-deep/85">{waitingText}</p>}
        {!calling && phase !== 'active' && <Spinner />}
      </div>);

  return (
    <Screen>
      {/* Everything floats over a full-screen video: a slim see-through header on top, the buttons at the bottom. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 [text-shadow:0_1px_3px_rgb(0_0_0/0.55)] [&>*]:pointer-events-auto">
      <header className="flex items-center gap-2.5 px-3 pb-1 pt-[calc(env(safe-area-inset-top,0px)+0.4rem)]">
        {/* Changed your mind before calling: a way out that also turns the camera and microphone off. */}
        {(phase === 'preview' || phase === 'loading' || phase === 'failed') && (
          <button type="button" aria-label="Back" title="Back" onClick={() => { stopEverything(); if (canGoBack) nav(-1); else nav('/messages', { replace: true }); }}
            className="-ml-1 inline-flex h-[2.75rem] w-[2.75rem] shrink-0 items-center justify-center rounded-full bg-deep/30 hover:bg-deep/50"><ArrowLeft size={22} /></button>)}
        <Avatar name={name} src={avatar} size="xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{name}</p>
          <p className="text-xs leading-tight text-on-deep/85" aria-live="polite">{calling && !doing ? <Dots>{calling}</Dots> : status}</p>
        </div>
        {!online && <span className="flex items-center gap-1 text-xs text-on-deep/80"><WifiOff size={14} />Offline</span>}
        {inCall && <LayoutPicker value={view.layout} onChange={(layout) => arrange({ layout })} />}
        {/* Laptops and desktops only: a phone already uses its own microphone, speaker and camera (flip is in the controls). */}
        {PICK_DEVICES && (
          <div className="relative">
            <button type="button" data-device-menu-toggle onClick={() => setSettings(!settings)} aria-expanded={settings}
              aria-label={voiceOnly ? 'Microphone and speaker settings' : 'Camera and microphone settings'} title="Settings"
              className="inline-flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-full bg-deep/30 hover:bg-deep/50"><Settings2 size={20} /></button>
            <DeviceMenu open={settings} voiceOnly={!!voiceOnly} onClose={() => setSettings(false)}
              onPick={async (kind, deviceId) => {
                if (media.current && snap?.state === 'connected') await media.current.switchDevice(kind, deviceId);
                else if (kind !== 'audiooutput') { await preview.current.switchDevice(kind, deviceId); setPreviewVideo(preview.current.videoRef()); }
              }} />
          </div>)}
      </header>
      {inCall && !chatOpen && <TopicStrip topic={topic ?? chosen} canChange={!topic && connected} onChange={() => setPicking(true)} />}
      </div>

      <main className="absolute inset-x-0 top-0 transition-[bottom] duration-200" style={{ bottom: chatOpen && inCall ? 0 : barH }} onClick={(e) => {
        if (!inCall || chatOpen || (e.target as HTMLElement).closest('button, a, input, [role="button"], [role="dialog"]')) return;
        setControlsHidden((h) => !h);
      }}>
        {phase === 'loading' && <div className="flex h-full items-center justify-center"><Spinner /></div>}
        {phase !== 'loading' && (
          <div className="relative h-full overflow-hidden">
            {inCall
              ? <CallStage layout={view.layout} corner={view.corner} onCorner={(corner) => arrange({ corner })}
                  onSwap={() => arrange({ layout: view.layout === 'me' ? 'them' : 'me' })}
                  main={view.layout === 'me' ? mine : theirs} side={view.layout === 'me' ? theirs : mine} />
              : <VideoTile video={localVideo} name={myName} caption="You" avatar={myAvatar} mirrored={facing === 'user'} label={voiceOnly ? 'You' : 'Your camera preview'} micOn={micOn} cameraNote={offNote} />}
            {inCall && peek && !chatOpen && (
              <button type="button" onClick={openChat} className="absolute inset-x-3 top-[calc(env(safe-area-inset-top,0px)+3.5rem)] z-20 mx-auto block max-w-sm rounded-md bg-deep/90 px-3 py-2 text-left text-sm shadow-pop">
                <span className="font-semibold">{name}: </span><span className="line-clamp-2">{peek.text}</span>
              </button>)}
            {inCall && chatOpen && <CallChat notes={notes} name={name} onSend={sendNote} onClose={() => setChatOpen(false)} />}
          </div>)}
      </main>

      <section ref={bar} className={clsx('pointer-events-none absolute inset-x-0 bottom-0 z-30 space-y-2 px-2 [&>*]:pointer-events-auto', !(chatOpen && inCall) && 'pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-2')}>
        {(deviceErrors.camera || deviceErrors.microphone) && !inCall && (
          <div role="status" className="space-y-1 rounded-md bg-on-deep/10 p-3 text-sm">
            {deviceErrors.microphone && <p>{deviceErrors.microphone}</p>}
            {deviceErrors.camera && <p>{deviceErrors.camera}{!deviceErrors.microphone && ' You can still talk with sound only.'}</p>}
          </div>)}
        {voiceOnly && (phase === 'preview' || phase === 'incoming') && !deviceErrors.camera && !deviceErrors.microphone && (
          <p className="text-center text-xs text-on-deep/80">Voice call: cameras stay off because a member under 16 is on this call.</p>)}
        {phase === 'preview' && snap?.ended === 'lost' && <p role="alert" className="text-center text-sm">Your connection dropped. Rejoin when you're back online.</p>}
        {phase === 'failed' && <p role="alert" className="text-center text-sm">{loadError || 'The call could not connect. Check your connection and try again.'}</p>}
        {snap?.needsAudioTap && (
          <div className="flex justify-center"><Button size="sm" onClick={() => void media.current?.startAudio()}><Volume2 size={16} />Tap to hear {name}</Button></div>)}
        {inCall && snap?.deviceError && <p role="status" className="text-center text-sm">{snap.deviceError}</p>}
        {error && <p role="alert" className="mx-auto max-w-md rounded-md bg-danger/25 px-3 py-2 text-center text-sm font-semibold">{error}</p>}

        {inCall && !chatOpen && (
          <div className="flex justify-center">
            <button type="button" onClick={() => setControlsHidden(!controlsHidden)} aria-label={controlsHidden ? 'Show call buttons' : 'Hide call buttons'} title={controlsHidden ? 'Show call buttons' : 'Hide call buttons'}
              className="inline-flex h-8 w-16 items-center justify-center rounded-full bg-on-deep/15 text-on-deep hover:bg-on-deep/25">{controlsHidden ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
          </div>)}
        {/* Always one row: buttons never wrap onto a second line. */}
        <div className={clsx('mx-auto flex max-w-md flex-nowrap items-start justify-center gap-x-1 sm:gap-x-3', inCall && (chatOpen || controlsHidden) && 'hidden')}>
          <ControlButton label={micOn ? 'Turn microphone off' : 'Turn microphone on'} caption={micOn ? 'Mic on' : 'Muted'} pressed={micOn} tone={micOn ? undefined : 'off'}
            onClick={() => void toggleMic()}>{micOn ? <Mic size={22} /> : <MicOff size={22} />}</ControlButton>
          {!voiceOnly && <ControlButton label={camOn ? 'Turn camera off' : 'Turn camera on'} caption={camOn ? 'Camera on' : 'Camera off'} pressed={camOn} tone={camOn ? undefined : 'off'}
            onClick={() => void toggleCam()}>{camOn ? <Video size={22} /> : <VideoOff size={22} />}</ControlButton>}
          {!voiceOnly && canFlip && <ControlButton label={facing === 'user' ? 'Switch to the back camera' : 'Switch to the front camera'} caption={facing === 'user' ? 'Front' : 'Back'}
            onClick={() => void flip()}><SwitchCamera size={22} /></ControlButton>}
          {inCall && <ControlButton label={chatOpen ? 'Close messages' : 'Open messages'} caption="Messages" pressed={chatOpen} badge={unread} disabled={!connected}
            onClick={() => (chatOpen ? setChatOpen(false) : openChat())}><MessageSquare size={22} /></ControlButton>}
          {phase === 'incoming' && <>
            <ControlButton label="Decline" caption="Decline" tone="end" disabled={busy} onClick={() => void decline()}><HangUpIcon size={22} /></ControlButton>
            <ControlButton label="Accept and join the call" caption="Accept" tone="go" disabled={busy} onClick={() => void answer()}><Phone size={22} /></ControlButton></>}
          {phase === 'preview' && (isNew
            ? <ControlButton label={`Call ${name}`} caption="Call" tone="go" disabled={busy || !to} onClick={() => void begin()}><Phone size={22} /></ControlButton>
            : <>
              <ControlButton label="Hang up" caption="Leave" tone="end" disabled={busy} onClick={() => void hangUp()}><HangUpIcon size={22} /></ControlButton>
              <ControlButton label="Rejoin the call" caption="Rejoin" tone="go" disabled={busy} onClick={() => void rejoin()}><RefreshCw size={22} /></ControlButton></>)}
          {phase === 'failed' && !isNew && call && <ControlButton label="Try again" caption="Try again" tone="go" disabled={busy} onClick={() => void rejoin()}><RefreshCw size={22} /></ControlButton>}
          {(inCall || phase === 'failed') && <ControlButton label={phase === 'ringing' ? 'Cancel call' : 'Hang up'} caption={phase === 'ringing' ? 'Cancel' : 'End'} tone="end" disabled={busy}
            onClick={phase === 'failed' ? () => void hangUp() : endTapped}><HangUpIcon size={22} /></ControlButton>}
          {phase === 'failed' && isNew && <Button variant="secondary" onClick={() => nav(-1)}>Back</Button>}
        </div>
      </section>

      <TopicPicker open={picking} band={topicLevel.band} startBand={topicLevel.max ?? level} maxBand={topicLevel.max} title="What shall we talk about?" onClose={() => setPicking(false)} onPick={pickTopic} />
      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="End the call now?">
        <p className="text-sm text-ink">You've talked {Math.floor(minutesTogether)} {Math.floor(minutesTogether) === 1 ? 'minute' : 'minutes'}. A topic call needs {topic?.min_minutes ?? 10} minutes together to be rated. Keep talking and the time keeps counting.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => { setConfirmEnd(false); void hangUp(); }}>End anyway</Button>
          <Button onClick={() => setConfirmEnd(false)}>Keep talking</Button>
        </div>
      </Modal>
    </Screen>
  );
}

/** Full screen and modal: rendered outside the app, which is made inert so keyboard focus can't wander behind it. */
/** Fixed: the page behind never scrolls, and when the keyboard opens the screen shrinks to the part still visible
 *  instead of sliding up, so the call stays put while typing. */
function Screen({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) root.inert = true;
    const html = document.documentElement; const body = document.body;
    const was = { html: html.style.overflow, body: body.style.overflow, overscroll: body.style.overscrollBehavior };
    html.style.overflow = 'hidden'; body.style.overflow = 'hidden'; body.style.overscrollBehavior = 'none';
    const vv = window.visualViewport;
    const fit = () => {
      const el = box.current; if (!el || !vv) return;
      el.style.height = `${vv.height}px`; el.style.transform = `translateY(${vv.offsetTop}px)`;
      if (window.scrollY) window.scrollTo(0, 0);
    };
    fit();
    vv?.addEventListener('resize', fit); vv?.addEventListener('scroll', fit);
    return () => {
      if (root) root.inert = false;
      html.style.overflow = was.html; body.style.overflow = was.body; body.style.overscrollBehavior = was.overscroll;
      vv?.removeEventListener('resize', fit); vv?.removeEventListener('scroll', fit);
    };
  }, []);
  return createPortal(
    <div ref={box} role="dialog" aria-modal="true" aria-label="Call" className="fixed inset-x-0 top-0 z-[60] flex h-[100dvh] flex-col overflow-hidden overscroll-none bg-deep text-on-deep">{children}</div>,
    document.body);
}

/** After a topic call: the partner rates it right here; the learner sees the score once it's in. */
function TopicEnded({ topic, name, rated, onRated }: { topic: TopicCall; name: string; rated: boolean; onRated: () => void }) {
  const mins = Math.round(topic.minutes);
  if (topic.i_am === 'partner') {
    if (rated) return <p className="text-sm text-on-deep/90">Thanks. Your rating counts toward {name}'s {topic.band} level.</p>;
    if (!topic.assess_blocker) return (
      <Card className="w-full text-left">
        <p className="mb-2 font-display text-lg text-ink">Rate {name} on “{topic.title}”</p>
        <AssessForm topic={topic} onDone={onRated} />
      </Card>);
    if (topic.assess_blocker === 'too_short') return <p className="text-sm text-on-deep/80">You talked {mins} {mins === 1 ? 'minute' : 'minutes'}. A topic call needs {topic.min_minutes} minutes together to be rated.</p>;
    return null;
  }
  if (topic.minutes < topic.min_minutes) return <p className="text-sm text-on-deep/80">You talked {mins} {mins === 1 ? 'minute' : 'minutes'}. A topic call needs {topic.min_minutes} minutes together to count, so try again.</p>;
  if (topic.score_pct != null) return <p className="text-sm text-on-deep/90">{name} rated this call {topic.score_pct}%. It counts toward your {topic.band} level.</p>;
  return <p className="text-sm text-on-deep/80">{name} has been asked to rate this call. You'll see the score on your profile.</p>;
}
