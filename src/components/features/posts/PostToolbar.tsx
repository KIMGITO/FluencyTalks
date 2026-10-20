import { useRef } from 'react';
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote, ImagePlus, Link2 } from 'lucide-react';
import type { BlockType } from '@/types/posts';

const btn = 'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 hover:text-ink';

export function Toolbar({ onFmt, onBlock, onImage, busy }: {
  onFmt: (tag: 'bold' | 'italic' | 'link') => void;
  onBlock: (t: BlockType) => void;
  onImage: (f: FileList | null) => void;
  busy: boolean;
}) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-surface-2/60 p-1">
      <button type="button" className={btn} title="Bold" aria-label="Bold" onClick={() => onFmt('bold')}><Bold size={16} /></button>
      <button type="button" className={btn} title="Italic" aria-label="Italic" onClick={() => onFmt('italic')}><Italic size={16} /></button>
      <button type="button" className={btn} title="Link" aria-label="Add link" onClick={() => onFmt('link')}><Link2 size={16} /></button>
      <span className="mx-1 h-5 w-px bg-border" />
      <button type="button" className={btn} title="Heading" aria-label="Heading" onClick={() => onBlock('h1')}><Heading1 size={16} /></button>
      <button type="button" className={btn} title="Sub heading" aria-label="Sub heading" onClick={() => onBlock('h2')}><Heading2 size={16} /></button>
      <button type="button" className={btn} title="Bullet list" aria-label="Bullet list" onClick={() => onBlock('ul')}><List size={16} /></button>
      <button type="button" className={btn} title="Numbered list" aria-label="Numbered list" onClick={() => onBlock('ol')}><ListOrdered size={16} /></button>
      <button type="button" className={btn} title="Quote" aria-label="Quote" onClick={() => onBlock('quote')}><Quote size={16} /></button>
      <span className="mx-1 h-5 w-px bg-border" />
      <button type="button" className={btn} title="Add image" aria-label="Add image" disabled={busy} onClick={() => file.current?.click()}><ImagePlus size={16} /></button>
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { onImage(e.target.files); e.target.value = ''; }} />
      {busy && <span className="px-2 text-xs text-muted">Uploading…</span>}
    </div>
  );
}
