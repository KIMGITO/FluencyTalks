// What a call is about: the strip under the call header, the device menu, and the vote after the call.
// Type-only imports from the media layer, so nothing here pulls in the provider SDK.
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Lightbulb, Shuffle, ThumbsDown, ThumbsUp } from 'lucide-react';
import { FormError, Select } from '@/components/ui';
import { listDevices, type DeviceKind } from '@/services/callMedia';
import { myCallVote, voteCall } from '@/services/connections';
import { CATEGORY_LABEL, type TopicCategory } from '@/services/path';
import { deviceErrorText } from '@/lib/callState';
import { userMessage } from '@/lib/errors';

export interface ShownTopic { band: string; title: string; category: TopicCategory; summary: string; prompts: string[]; ideas: string[]; goal?: string }

/**
 * The topic on top of the call. Its prompts and ideas drift past so there's always something to say; tap the arrow
 * for the full list. On an ordinary call either person can pick or change it, and the other sees the same one.
 */
export function TopicStrip({ topic, canChange, onChange }: { topic: ShownTopic | null; canChange: boolean; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  if (!topic) {
    if (!canChange) return null;
    return (
      <button type="button" onClick={onChange} className="mx-auto mb-1 flex w-fit items-center justify-center gap-1.5 rounded-full bg-deep/20 px-3 py-1 text-xs text-on-deep hover:bg-deep/40">
        <Lightbulb size={13} aria-hidden />Pick a topic to talk about
      </button>);
  }
  const items = [...topic.prompts, ...topic.ideas];
  // Long lists drift more slowly, so each line stays readable.
  const seconds = Math.max(30, items.join(' ').length / 6);
  return (
    // Floats over the video: opening the ideas lays them on top and never moves or resizes the videos.
    <div className={clsx('relative mx-2 mb-1 rounded-md border-l-2 border-accent backdrop-blur-[2px] sm:mx-4', open ? 'bg-deep/55' : 'bg-deep/20')}>
      <div className="flex items-center gap-1.5 px-2 pt-0.5">
        <span className="rounded-sm bg-accent/90 px-1 text-[0.65rem] font-bold leading-4 text-on-brand">{topic.band}</span>
        <p className="min-w-0 flex-1 truncate font-display text-sm uppercase italic leading-tight"><span className="sr-only">Topic: </span>{topic.title}</p>
        {canChange && <button type="button" onClick={onChange} aria-label="Change the topic" title="Change the topic" className="rounded-full p-1 hover:bg-on-deep/15"><Shuffle size={14} /></button>}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Hide the prompts' : 'Show all prompts'} title="All prompts"
          className="rounded-full p-1 hover:bg-on-deep/15"><ChevronDown size={14} className={clsx('transition-transform', open && 'rotate-180')} /></button>
      </div>
      {!open && (
        <div className="ft-marquee-wrap overflow-hidden px-2 pb-1" tabIndex={0} aria-label="Things to talk about">
          <ul className="ft-marquee text-xs leading-5 text-on-deep/90" style={{ ['--ft-marquee-s' as string]: `${seconds}s` }}>
            {[0, 1].map((copy) => items.map((t, i) => (
              <li key={`${copy}:${i}`} aria-hidden={copy === 1} className="whitespace-nowrap pr-8"><span aria-hidden className="pr-2 text-accent">●</span>{t}</li>)))}
          </ul>
        </div>)}
      {open && (
        <div className="max-h-[35vh] space-y-1.5 overflow-y-auto px-2 pb-2 pt-0.5 text-xs">
          <p className="text-on-deep/80">{CATEGORY_LABEL[topic.category]} · {topic.summary}</p>
          {topic.goal && <p className="text-xs text-on-deep/70">{topic.band} goal: {topic.goal}</p>}
          <ol className="list-decimal space-y-1 pl-5 text-on-deep/95">{topic.prompts.map((p) => <li key={p}>{p}</li>)}</ol>
          {topic.ideas.length > 0 && <>
            <p className="pt-1 text-xs font-bold uppercase tracking-wide text-on-deep/70">If you run out of things to say</p>
            <ul className="space-y-1 text-on-deep/90">{topic.ideas.map((p) => <li key={p}>· {p}</li>)}</ul>
          </>}
        </div>)}
    </div>
  );
}

/** Camera, microphone and speaker, in a small menu under the settings button at the top right. */
export function DeviceMenu({ open, voiceOnly, onClose, onPick }: { open: boolean; voiceOnly: boolean; onClose: () => void; onPick: (kind: DeviceKind, id: string) => Promise<void> }) {
  const [devices, setDevices] = useState<Record<DeviceKind, MediaDeviceInfo[]>>({ audioinput: [], videoinput: [], audiooutput: [] });
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    Promise.all((['audioinput', 'videoinput', 'audiooutput'] as const).map(listDevices))
      .then(([audioinput, videoinput, audiooutput]) => setDevices({ audioinput, videoinput, audiooutput }));
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-device-menu-toggle]')) onClose(); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open, onClose]);
  if (!open) return null;
  const pick = (kind: DeviceKind) => (e: React.ChangeEvent<HTMLSelectElement>) => { setError(''); onPick(kind, e.target.value).catch((err) => setError(deviceErrorText(err, kind === 'videoinput' ? 'camera' : 'microphone'))); };
  const rows = ([['audioinput', 'Microphone'], ['videoinput', 'Camera'], ['audiooutput', 'Speaker']] as [DeviceKind, string][])
    .filter(([k]) => (!voiceOnly || k !== 'videoinput') && devices[k].length);
  return (
    <div ref={box} role="dialog" aria-label={voiceOnly ? 'Microphone and speaker' : 'Camera and microphone'}
      className="absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] space-y-2 rounded-md bg-surface p-3 text-sm text-ink shadow-pop">
      {rows.map(([kind, label]) => (
        <Select key={kind} label={label} onChange={pick(kind)} defaultValue="">
          <option value="" disabled>Choose a {label.toLowerCase()}</option>
          {devices[kind].map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `${label} ${i + 1}`}</option>)}
        </Select>))}
      {!rows.length && <p className="text-muted">No camera or microphone found. Your browser may need permission first.</p>}
      <FormError small>{error}</FormError>
    </div>
  );
}

/** Was it a good call? One tap, changeable. Only a count of good calls is ever shown, on their profile. */
export function CallVote({ callId, name }: { callId: string; name: string }) {
  const [vote, setVote] = useState<'good' | 'bad' | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { myCallVote(callId).then(setVote).catch(() => undefined); }, [callId]);
  const cast = async (v: 'good' | 'bad') => {
    const was = vote; setVote(v); setError('');
    try { await voteCall(callId, v); } catch (e) { setVote(was); setError(userMessage(e)); }
  };
  const btn = (v: 'good' | 'bad', label: string, Icon: typeof ThumbsUp) => (
    <button type="button" aria-pressed={vote === v} onClick={() => void cast(v)}
      className={clsx('inline-flex min-h-[2.75rem] items-center gap-2 rounded-full border px-4 font-semibold transition-colors',
        vote === v ? (v === 'good' ? 'border-go bg-go text-on-brand' : 'border-danger bg-danger text-on-brand') : 'border-on-deep/40 hover:bg-on-deep/10')}>
      <Icon size={18} aria-hidden />{label}
    </button>);
  return (
    <div className="w-full space-y-2 rounded-md bg-on-deep/10 p-3">
      <p className="text-sm font-semibold">{vote ? 'Thanks for your feedback.' : `How was your call with ${name}?`}</p>
      <div className="flex justify-center gap-2">{btn('good', 'Good', ThumbsUp)}{btn('bad', 'Bad', ThumbsDown)}</div>
      {error && <p role="alert" className="text-xs">{error}</p>}
    </div>
  );
}
