import { useState } from 'react';
import clsx from 'clsx';
import { ImagePlus, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { uid } from '@/lib/blocks';
import { uploadPostImage } from '@/services/posts';
import { Toolbar } from './PostToolbar';
import type { BlockType, RichBlock } from '@/types/posts';

export function PostEditor({ blocks, onChange, userId }: { blocks: RichBlock[]; onChange: (b: RichBlock[]) => void; userId: string }) {
  const [focus, setFocus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (id: string, patch: Partial<RichBlock>) => onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const add = (type: BlockType, after?: string) => {
    const nb: RichBlock = type === 'ul' || type === 'ol' ? { id: uid(), type, items: [''] } : type === 'image' ? { id: uid(), type, src: '', caption: '' } : { id: uid(), type, text: '' };
    if (!after) { onChange([...blocks, nb]); setFocus(nb.id); return; }
    const i = blocks.findIndex((b) => b.id === after);
    onChange([...blocks.slice(0, i + 1), nb, ...blocks.slice(i + 1)]); setFocus(nb.id);
  };
  const del = (id: string) => onChange(blocks.filter((b) => b.id !== id));
  const fmt = (tag: 'bold' | 'italic' | 'link') => {
    const el = focus ? document.querySelector<HTMLTextAreaElement>(`[data-block="${focus}"]`) : null;
    const b = blocks.find((x) => x.id === focus);
    if (!el || !b || b.type === 'image' || b.type === 'ul' || b.type === 'ol') {
      onChange([...blocks, { id: uid(), type: 'paragraph', text: tag === 'link' ? '[link text](https://...)' : tag === 'bold' ? '**bold text**' : '*italic text*' }]);
      return;
    }
    const s = el.selectionStart ?? 0; const e = el.selectionEnd ?? 0;
    const cur = b.text ?? '';
    const sel = cur.slice(s, e) || (tag === 'link' ? 'link text' : 'text');
    const rep = tag === 'bold' ? `**${sel}**` : tag === 'italic' ? `*${sel}*` : `[${sel}](https://...)`;
    set(b.id, { text: cur.slice(0, s) + rep + cur.slice(e) });
  };
  const onImage = async (files: FileList | null, id?: string) => {
    const f = files?.[0]; if (!f) return;
    setErr(''); setBusy(true);
    try {
      const url = await uploadPostImage(userId, f);
      if (id) set(id, { src: url });
      else { const nb: RichBlock = { id: uid(), type: 'image', src: url, caption: '' }; onChange([...blocks, nb]); setFocus(nb.id); }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Image upload failed.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-2">
      <Toolbar onFmt={fmt} onBlock={(t) => (t === 'image' ? add(t) : add(t, focus ?? undefined))} onImage={(f) => void onImage(f)} busy={busy} />
      {err && <p className="text-sm text-danger">{err}</p>}
      {blocks.map((b) => (
        <div key={b.id} className={clsx('group relative rounded-md border border-transparent focus-within:border-brand/40', b.type === 'image' && 'border-border p-2')}>
          {(b.type === 'paragraph' || b.type === 'h1' || b.type === 'h2' || b.type === 'quote') && (
            <textarea data-block={b.id} rows={b.type === 'paragraph' ? 2 : 1} value={b.text ?? ''}
              placeholder={b.type === 'h1' ? 'Heading' : b.type === 'h2' ? 'Sub heading' : b.type === 'quote' ? 'Quote...' : 'Write... (**bold**, *italic*, [link](url))'}
              onFocus={() => setFocus(b.id)} onChange={(e) => set(b.id, { text: e.target.value })}
              className={clsx('w-full resize-y bg-transparent px-2 py-1.5 outline-none placeholder:text-muted', b.type === 'h1' && 'text-xl font-bold', b.type === 'h2' && 'text-lg font-semibold', b.type === 'quote' && 'border-l-2 border-brand/50 italic')} />
          )}
          {(b.type === 'ul' || b.type === 'ol') && (
            <div className="flex flex-col gap-1 px-2 py-1">
              {(b.items ?? []).map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-sm text-muted">{b.type === 'ul' ? '\u2022' : `${i + 1}.`}</span>
                  <input value={it} placeholder={i === 0 ? 'List item...' : ''} onFocus={() => setFocus(b.id)}
                    onChange={(e) => set(b.id, { items: (b.items ?? []).map((x, j) => (j === i ? e.target.value : x)) })}
                    className="min-w-0 flex-1 bg-transparent py-1 outline-none placeholder:text-muted" />
                  <button type="button" aria-label="Remove item" className="text-muted hover:text-danger" onClick={() => set(b.id, { items: (b.items ?? []).filter((_, j) => j !== i) })}>x</button>
                </div>
              ))}
              <button type="button" className="self-start px-7 text-xs font-semibold text-brand hover:underline" onClick={() => set(b.id, { items: [...(b.items ?? []), ''] })}>+ Add item</button>
            </div>
          )}
          {b.type === 'image' && (
            <div className="flex flex-col gap-1.5">
              {b.src ? <img src={b.src} alt={b.caption ?? ''} className="max-h-80 w-full rounded-md object-contain cursor-pointer" />
              : <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-surface-2 py-8 text-sm text-muted hover:text-ink">
                  <ImagePlus size={18} /> Pick a picture
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { void onImage(e.target.files, b.id); e.target.value = ''; }} />
                </label>}
              <input value={b.caption ?? ''} onChange={(e) => set(b.id, { caption: e.target.value })} onFocus={() => setFocus(b.id)}
                placeholder="Caption (shows under the picture, like Facebook)..." className="bg-transparent px-1 text-sm outline-none placeholder:text-muted" />
            </div>
          )}
          <div className="absolute -right-1 -top-2 hidden gap-1 group-hover:flex">
            <button type="button" aria-label="Add block below" className="rounded-full bg-surface-2 p-1 text-muted shadow-card hover:text-brand" onClick={() => add('paragraph', b.id)}><Plus size={14} /></button>
            <button type="button" aria-label="Delete block" className="rounded-full bg-surface-2 p-1 text-muted shadow-card hover:text-danger" onClick={() => del(b.id)}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="secondary" onClick={() => add('paragraph')}>+ Text</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => add('image')}>+ Image</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => add('ul')}>+ List</Button>
      </div>
    </div>
  );
}
