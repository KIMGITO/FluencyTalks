import { useState } from 'react';
import { Image, X } from 'lucide-react';
import { MAX_OVERLAY_TEXT } from '@/lib/postTypes';
import type { ImageLayout } from '@/services/library';
import { UnsplashPicker } from './UnsplashPicker';

const LAYOUTS: { value: ImageLayout; label: string }[] = [{ value: 'above', label: 'Text below the image' }, { value: 'overlay', label: 'Text on the image' }];

/** Choosing an Unsplash image and where the text goes. Anyone can use images: there's no level or points to earn first. */
export function ImageField({ url, layout, textLength, label, onUrl, onLayout }: {
  url: string; layout: ImageLayout; textLength: number; label: string;
  onUrl: (url: string) => void; onLayout: (layout: ImageLayout) => void;
}) {
  const [thumb, setThumb] = useState('');
  const [attrib, setAttrib] = useState<{ name: string; link: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const tooLong = textLength > MAX_OVERLAY_TEXT;

  if (picking) {
    return (
      <UnsplashPicker
        onSelect={(regular, small, by) => { onUrl(regular); setThumb(small); setAttrib(by); setPicking(false); }}
        onCancel={() => setPicking(false)}
      />
    );
  }
  if (!url) {
    return (
      <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-4 text-sm text-muted transition hover:border-brand/50 hover:text-brand">
        <Image size={18} aria-hidden /> {label}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-md">
        <img src={thumb || url} alt="Selected" className="h-[12rem] w-full object-cover" />
        <div className="absolute inset-0 flex flex-col justify-between p-2">
          <button type="button" aria-label="Remove the image" onClick={() => { onUrl(''); onLayout('above'); setThumb(''); setAttrib(null); }} className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-ink/60 text-on-deep transition hover:bg-ink/80">
            <X size={16} aria-hidden />
          </button>
          {attrib && (
            <p className="bg-deep/40 px-2 py-1 text-[10px] text-on-deep/80">
              Photo by <a href={attrib.link} target="_blank" rel="noopener noreferrer" className="underline">{attrib.name}</a> on Unsplash
            </p>
          )}
        </div>
      </div>
      <div role="radiogroup" aria-label="Where the text goes" className="flex flex-wrap gap-1.5">
        {LAYOUTS.map((l) => (
          <button
            key={l.value} type="button" role="radio" aria-checked={layout === l.value}
            disabled={l.value === 'overlay' && tooLong}
            onClick={() => onLayout(l.value)}
            className={`min-h-9 rounded-full border border-border px-3 text-xs font-semibold transition disabled:opacity-50 ${layout === l.value ? 'bg-brand-soft text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}
          >{l.label}</button>
        ))}
      </div>
      {tooLong && <p className="text-xs text-muted">Text on an image has to stay short to be readable: {MAX_OVERLAY_TEXT} characters at most.</p>}
    </div>
  );
}
