// Pieces of the call screen. Type-only imports from the media layer, so nothing here pulls in the provider SDK.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { MicOff, Send, VideoOff, X, Phone } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { NOTE_MAX, type CallNote, type MediaRef } from '@/services/callMedia';

const still = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Bars that move with someone's voice. `level` is read every frame (0 to 1), so talking louder moves them more;
 * while they're quiet the bars rest low. With reduced motion they only light up.
 */
export function VoiceWave({ level, speaking, size = 'md', className }: { level?: () => number; speaking?: boolean; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    if (still()) return;
    let raf = 0; let t = 0;
    const shape = [0.55, 0.85, 1, 0.85, 0.55];
    const frame = () => {
      t += 1;
      const raw = speaking ? Math.max(level?.() ?? 0, 0.25) : 0;
      const loud = Math.min(1, Math.sqrt(raw) * 1.4);
      bars.current.forEach((el, i) => {
        if (!el) return;
        const wobble = loud ? 0.55 + 0.45 * Math.abs(Math.sin(t / 5 + i * 1.3)) : 0;
        el.style.transform = `scaleY(${Math.max(0.18, loud * shape[i] * wobble)})`;
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [level, speaking]);
  const h = size === 'lg' ? 'h-8' : size === 'sm' ? 'h-3' : 'h-5';
  return (
    <span aria-hidden className={clsx('inline-flex items-center gap-0.5', h, className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} ref={(el) => { bars.current[i] = el; }}
          className={clsx('h-full origin-center rounded-full transition-colors', size === 'lg' ? 'w-1.5' : 'w-1', speaking ? 'bg-go' : 'bg-on-deep/50')}
          style={{ transform: 'scaleY(0.18)' }} />))}
    </span>
  );
}

export function VideoTile({ video, audio, name, caption, avatar, mirrored, small, micOn = true, speaking, level, label, cameraNote }: {
  video: MediaRef | null; audio?: MediaRef | null;
  /** Whose picture or initials show when the camera is off. */
  name: string;
  /** The tag in the corner, when it should differ from the name ("You" on your own tile). */
  caption?: string;
  avatar?: string | null; mirrored?: boolean; small?: boolean;
  micOn?: boolean; speaking?: boolean; level?: () => number; label?: string;
  /** Said when there's no picture, e.g. "Camera off". Left out for a voice call, where no one has a camera. */
  cameraNote?: string;
}) {
  const v = useRef<HTMLVideoElement>(null); const a = useRef<HTMLAudioElement>(null);
  useEffect(() => { const el = v.current; if (!el || !video) return; video.attach(el); return () => video.detach(el); }, [video]);
  useEffect(() => { const el = a.current; if (!el || !audio) return; audio.attach(el); return () => audio.detach(el); }, [audio]);
  return (
    <figure className={clsx('relative m-0 h-full w-full overflow-hidden bg-deep', 'rounded-md',
      speaking && 'outline outline-2 -outline-offset-2 outline-go')} aria-label={label ?? name}>
      {video
        ? <video ref={v} autoPlay playsInline muted className={clsx('h-full w-full object-cover', mirrored && '-scale-x-100')} />
        : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-on-deep/5">
            <span className={clsx('rounded-full transition-shadow', speaking && 'shadow-[0_0_0_4px_rgb(var(--c-go)/0.6)]')}>
              <Avatar name={name} src={avatar} size={small ? 'md' : 'xl'} />
            </span>
            {!small && <VoiceWave level={level} speaking={speaking && micOn} size="lg" />}
            {!small && cameraNote && <span className="flex items-center gap-1.5 rounded-full bg-deep/70 px-3 py-1 text-xs text-on-deep/90"><VideoOff size={13} aria-hidden />{cameraNote}</span>}
          </div>)}
      {audio && <audio ref={a} autoPlay />}
      <figcaption className={clsx('absolute flex items-center gap-1.5 rounded-sm bg-deep/70 text-on-deep', small ? 'bottom-1 left-1 px-1.5 py-0.5 text-[0.7rem]' : 'bottom-2 left-2 px-2 py-1 text-xs')}>
        {micOn ? <VoiceWave level={level} speaking={speaking} size="sm" /> : <MicOff size={small ? 11 : 13} className="text-danger" aria-label="Microphone off" />}
        <span className="max-w-[9rem] truncate">{caption ?? name}</span>
        {small && !video && cameraNote && <VideoOff size={11} aria-label={cameraNote} />}
      </figcaption>
    </figure>
  );
}

/**
 * A round call control with its state written under it. The icon and the word show how it is now ("Muted",
 * "Camera off"); the screen-reader label says what pressing it does.
 * `tone`: off = switched off (white, crossed icon: a state, not a danger), end = hang up (wide red), go = answer or start (green).
 */
/** Hang up / decline: the same handset as the call button, turned to lie horizontal. Always on red. */
export function HangUpIcon({ size = 22 }: { size?: number }) {
  return <Phone size={size} aria-hidden className="rotate-[135deg]" />;
}

/** A word followed by three dots that bounce in turn: "Calling…". Screen readers get the plain word. */
export function Dots({ children }: { children: ReactNode }) {
  return (
    <span>{children}<span aria-hidden className="ft-dots ml-0.5"><span>.</span><span>.</span><span>.</span></span></span>);
}

export function ControlButton({ label, caption, onClick, pressed, tone, disabled, badge, children }: {
  label: string; caption?: string; onClick: () => void; pressed?: boolean; tone?: 'off' | 'end' | 'go'; disabled?: boolean; badge?: number; children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 max-w-[4.5rem] flex-1 flex-col items-center gap-1">
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} aria-pressed={pressed}
        className={clsx('relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition [&_svg]:h-[22px] [&_svg]:w-[22px] disabled:cursor-not-allowed disabled:opacity-50',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-deep',
          tone === 'end' ? 'bg-danger text-on-brand hover:bg-danger/90'
            : tone === 'go' ? 'bg-go text-on-brand hover:bg-go/90'
              : tone === 'off' ? 'bg-on-deep text-deep hover:bg-on-deep/90'
                : 'bg-on-deep/15 text-on-deep hover:bg-on-deep/25')}>
        {children}
        {!!badge && <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-go px-1 text-[0.65rem] font-bold leading-[1.1rem] text-on-brand" aria-label={`${badge} new`}>{badge > 9 ? '9+' : badge}</span>}
      </button>
      {caption && <span aria-hidden className="max-w-full truncate text-xs text-on-deep/90">{caption}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- layout

export type CallLayout = 'them' | 'me' | 'stack' | 'side';
export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export const LAYOUTS: { id: CallLayout; label: string; detail: string }[] = [
  { id: 'them', label: 'Them in front', detail: 'Your partner fills the screen, you in the small window' },
  { id: 'me', label: 'Them behind', detail: 'You fill the screen, your partner in the small window' },
  { id: 'stack', label: 'Top and bottom', detail: 'Partner on top, you below, same size' },
  { id: 'side', label: 'Left and right', detail: 'Partner on the left, you on the right, same size' },
];
/** Layouts saved before there were four. */
export const layoutFrom = (v: unknown): CallLayout => (v === 'split' ? 'stack' : LAYOUTS.some((l) => l.id === v) ? (v as CallLayout) : 'them');

/**
 * A tiny drawing of the screen for each layout. The filled shape is your partner, the outlined one is you,
 * the same in every drawing, so they read at a glance.
 */
export function LayoutIcon({ layout, size = 22 }: { layout: CallLayout; size?: number }) {
  const them = { fill: 'currentColor' };
  const you = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="2" width="18" height="20" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".55" />
      {layout === 'them' && <><rect x="5" y="4" width="14" height="16" rx="1.2" {...them} opacity=".9" /><rect x="12.5" y="13.5" width="5" height="5" rx=".8" fill="rgb(var(--c-deep))" stroke="currentColor" strokeWidth="1.5" /></>}
      {layout === 'me' && <><rect x="5.75" y="4.75" width="12.5" height="14.5" rx="1.2" {...you} /><rect x="12.5" y="13.5" width="5" height="5" rx=".8" {...them} /></>}
      {layout === 'stack' && <><rect x="5" y="4" width="14" height="7.25" rx="1.2" {...them} /><rect x="5.75" y="13.5" width="12.5" height="5.75" rx="1.2" {...you} /></>}
      {layout === 'side' && <><rect x="5" y="4" width="6.25" height="16" rx="1.2" {...them} /><rect x="13.5" y="4.75" width="4.75" height="14.5" rx="1.2" {...you} /></>}
    </svg>);
}

/** The layout button in the call header: each tap moves to the next of the four layouts, round and round. */
export function LayoutPicker({ value, onChange }: { value: CallLayout; onChange: (l: CallLayout) => void }) {
  const i = Math.max(0, LAYOUTS.findIndex((l) => l.id === value));
  const cur = LAYOUTS[i]; const next = LAYOUTS[(i + 1) % LAYOUTS.length];
  return (
    <button type="button" onClick={() => onChange(next.id)} aria-label={`Screen layout: ${cur.label}. Tap for ${next.label}`} title={`Switch to ${next.label}`}
      className="inline-flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-full bg-deep/30 hover:bg-deep/50">
      <LayoutIcon layout={value} />
    </button>);
}

const CORNERS: Record<Corner, string> = { tl: 'left-3 top-[calc(env(safe-area-inset-top,0px)+3.75rem)]', tr: 'right-3 top-[calc(env(safe-area-inset-top,0px)+3.75rem)]', bl: 'bottom-3 left-3', br: 'bottom-3 right-3' };

/**
 * The two videos, arranged by `layout`. In the "in front" layouts the small window can be dragged to any corner,
 * and tapping it swaps who is in front.
 */
export function CallStage({ layout, main, side, corner, onCorner, onSwap }: {
  layout: CallLayout; main: ReactNode; side: ReactNode; corner: Corner; onCorner: (c: Corner) => void; onSwap: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  if (layout === 'stack' || layout === 'side') {
    return (
      <div className={clsx('grid h-full gap-2', layout === 'stack' ? 'grid-cols-1 grid-rows-2' : 'grid-cols-2 grid-rows-1')}>
        <div className="min-h-0 min-w-0">{main}</div><div className="min-h-0 min-w-0">{side}</div>
      </div>);
  }
  return (
    <div ref={box} className="relative h-full">
      {main}
      <Floating corner={corner} box={box} onCorner={onCorner} onTap={onSwap}>{side}</Floating>
    </div>);
}

function Floating({ corner, box, onCorner, onTap, children }: { corner: Corner; box: React.RefObject<HTMLDivElement>; onCorner: (c: Corner) => void; onTap: () => void; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const down = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false }; el.current?.setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const x = e.clientX - d.x; const y = e.clientY - d.y;
    if (!d.moved && Math.hypot(x, y) < 6) return;
    d.moved = true; setOffset({ x, y });
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null; if (!d || d.id !== e.pointerId) return;
    setOffset(null);
    if (!d.moved) { onTap(); return; }
    const b = box.current?.getBoundingClientRect(); const r = el.current?.getBoundingClientRect(); if (!b || !r) return;
    const cx = r.left + r.width / 2 - b.left; const cy = r.top + r.height / 2 - b.top;
    onCorner(`${cy < b.height / 2 ? 't' : 'b'}${cx < b.width / 2 ? 'l' : 'r'}` as Corner);
  };
  // Arrow keys move it too, and Enter swaps, so it works without a pointer.
  const key = (e: React.KeyboardEvent) => {
    const v = corner[0]; const h = corner[1];
    const next = { ArrowUp: `t${h}`, ArrowDown: `b${h}`, ArrowLeft: `${v}l`, ArrowRight: `${v}r` }[e.key] as Corner | undefined;
    if (next) { e.preventDefault(); onCorner(next); } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(); }
  };
  return (
    <div ref={el} role="button" tabIndex={0} aria-label="Small window. Tap to swap, drag or use the arrow keys to move it"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setOffset(null); }} onKeyDown={key}
      className={clsx('absolute z-10 aspect-[3/4] w-[7rem] cursor-grab touch-none select-none rounded-md shadow-pop sm:w-[10rem]', CORNERS[corner],
        offset ? 'cursor-grabbing' : 'transition-[top,left,right,bottom] duration-200')}
      style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}>
      <div className="pointer-events-none h-full">{children}</div>
    </div>);
}

// ---------------------------------------------------------------- messages

/** Messages typed during the call. They go to the other person directly and disappear when the call ends. */
export function CallChat({ notes, name, onSend, onClose }: { notes: CallNote[]; name: string; onSend: (text: string) => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState(''); const [error, setError] = useState(''); const [sending, setSending] = useState(false);
  const list = useRef<HTMLOListElement>(null); const input = useRef<HTMLInputElement>(null);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [notes.length]);
  useEffect(() => { input.current?.focus(); }, []);
  const send = async () => {
    const t = text.trim(); if (!t || sending) return;
    setSending(true); setError('');
    try { await onSend(t); setText(''); } catch { setError("That didn't send. Check your connection and try again."); } finally { setSending(false); input.current?.focus(); }
  };
  // Minimal and see-through: the call stays visible behind; only the bubbles and the input sit on it.
  return (
    // The aside lets taps through to the video (drag the small window etc.); only its pieces catch them.
    <aside aria-label="Messages in this call" className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end">
      <button type="button" onClick={onClose} aria-label="Close messages"
        className="pointer-events-auto absolute right-2 top-[calc(env(safe-area-inset-top,0px)+3.5rem)] z-10 inline-flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-full bg-deep/60 text-on-deep hover:bg-deep/80"><X size={18} /></button>
      {/* Short, scrollable, and see-through: bubbles fade away into the video at the top edge. */}
      <ol ref={list} className="ft-fade-top pointer-events-auto ml-auto max-h-[min(40%,15rem)] min-h-0 w-full max-w-[min(80%,22rem)] space-y-1 overflow-y-auto overscroll-contain px-3 pb-2 pt-8" aria-live="polite">
        {notes.map((n, i) => {
          const tail = notes[i - 1]?.mine !== n.mine;
          return (
            <li key={n.id} className={clsx('flex', n.mine ? 'justify-end pr-2' : 'justify-start pl-2', tail && i > 0 && 'pt-1.5')}>
              <p className={clsx('ft-bubble relative max-w-[90%] whitespace-pre-wrap shadow-pop', n.mine ? 'ft-bubble-out' : 'ft-bubble-in', tail && 'ft-tail')}>
                <span className="sr-only">{n.mine ? 'You: ' : `${name}: `}</span>{n.text}
              </p>
            </li>);
        })}
      </ol>
      {error && <p role="alert" className="pointer-events-auto mx-3 mb-1 self-start rounded-md bg-danger px-2 py-1 text-xs text-on-brand">{error}</p>}
      <form className="pointer-events-auto flex items-center gap-2 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]" noValidate onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input ref={input} value={text} onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX))} aria-label={`Message ${name}`} placeholder="Message"
          enterKeyHint="send" autoComplete="off"
          className="h-12 min-w-0 flex-1 rounded-full border border-on-deep/20 bg-deep/60 px-4 text-[16px] text-on-deep outline-none placeholder:text-on-deep/60 focus:border-on-deep/50" />
        <button type="submit" disabled={!text.trim() || sending} aria-label="Send"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand disabled:opacity-40"><Send size={22} /></button>
      </form>
    </aside>
  );
}
