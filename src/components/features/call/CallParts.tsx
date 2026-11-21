// Pieces of the call screen. Type-only imports from the media layer, so nothing here pulls in the provider SDK.
import { useEffect, useRef, type ReactNode } from 'react';
import clsx from 'clsx';
import { MicOff } from 'lucide-react';
import { Avatar } from '@/components/ui';
import type { MediaRef } from '@/services/callMedia';

export function VideoTile({ video, audio, name, avatar, mirrored, small, micOn = true, speaking, label }: {
  video: MediaRef | null; audio?: MediaRef | null; name: string; avatar?: string | null; mirrored?: boolean; small?: boolean;
  micOn?: boolean; speaking?: boolean; label?: string;
}) {
  const v = useRef<HTMLVideoElement>(null); const a = useRef<HTMLAudioElement>(null);
  useEffect(() => { const el = v.current; if (!el || !video) return; video.attach(el); return () => video.detach(el); }, [video]);
  useEffect(() => { const el = a.current; if (!el || !audio) return; audio.attach(el); return () => audio.detach(el); }, [audio]);
  return (
    <figure className={clsx('relative m-0 overflow-hidden bg-deep', small ? 'aspect-[3/4] w-[7rem] rounded-md shadow-lg sm:w-[10rem]' : 'h-full w-full',
      speaking && 'outline outline-2 outline-accent')} aria-label={label ?? name}>
      {video
        ? <video ref={v} autoPlay playsInline muted className={clsx('h-full w-full object-cover', mirrored && '-scale-x-100')} />
        : <div className="flex h-full w-full items-center justify-center"><Avatar name={name} src={avatar} size={small ? 'md' : 'xl'} /></div>}
      {audio && <audio ref={a} autoPlay />}
      {!small && (
        <figcaption className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-sm bg-deep/70 px-2 py-1 text-xs text-on-deep">
          {!micOn && <MicOff size={13} aria-label="Microphone off" />}{name}
        </figcaption>)}
      {small && !micOn && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-deep/70 p-1 text-on-deep"><MicOff size={12} aria-label="Your microphone is off" /></span>}
    </figure>
  );
}

/** A round call control. `pressed` is for toggles, so screen readers hear "on" and "off". */
export function ControlButton({ label, onClick, pressed, danger, primary, disabled, children }: {
  label: string; onClick: () => void; pressed?: boolean; danger?: boolean; primary?: boolean; disabled?: boolean; children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} aria-pressed={pressed}
      className={clsx('inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        danger ? 'bg-danger text-on-brand hover:opacity-90' : primary ? 'bg-accent text-deep hover:opacity-90'
          : pressed === false ? 'bg-on-deep text-deep' : 'bg-on-deep/15 text-on-deep hover:bg-on-deep/25')}>
      {children}
    </button>
  );
}
