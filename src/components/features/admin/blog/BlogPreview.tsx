import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Monitor, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { postCardsHtml, postHtml, type Post } from '@/lib/blogHtml';

/**
 * Exactly what the public page will show: the same HTML and the same stylesheets, in a frame. A frame because the layout
 * follows the width of the screen, so it is the only way to see the phone layout on a computer. Scripts stay off in it.
 */
export function BlogPreview({ post, isLive, publishing, onPublish, onClose }: { post: Post; isLive: boolean; publishing: boolean; onPublish: () => void; onClose: () => void }) {
  const [view, setView] = useState<'post' | 'card'>('post');
  const [width, setWidth] = useState<'full' | 'phone'>('full');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  const srcDoc = useMemo(() => {
    const styles = [...document.head.querySelectorAll('style, link[rel="stylesheet"]')].map((el) => el.outerHTML).join('');
    const theme = document.documentElement.getAttribute('data-theme');
    const body = view === 'post' ? postHtml(post, [], true) : `<ul class="lp-postgrid" style="padding-top:2rem">${postCardsHtml([post])}</ul>`;
    return `<!doctype html><html lang="en"${theme ? ` data-theme="${theme}"` : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${styles}</head><body><div class="lp"><main><div class="lp-wrap">${body}</div></main></div></body></html>`;
  }, [post, view]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Preview" className="fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface p-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] md:px-4">
        <Button variant="ghost" size="sm" className="h-10 w-10 px-0" aria-label="Close the preview" onClick={onClose}><X size={20} aria-hidden /></Button>
        <p className="min-w-0 flex-1 text-sm"><b>Preview.</b> <span className="text-muted">{isLive ? 'The site still shows the published version.' : 'Nobody else can see this.'}</span></p>
        <div className="flex items-center gap-1">
          <Button size="sm" variant={view === 'post' ? 'secondary' : 'ghost'} aria-pressed={view === 'post'} onClick={() => setView('post')}>Post</Button>
          <Button size="sm" variant={view === 'card' ? 'secondary' : 'ghost'} aria-pressed={view === 'card'} onClick={() => setView('card')}>In the list</Button>
        </div>
        <div className="hidden items-center gap-1 md:flex">
          <Button size="sm" variant={width === 'full' ? 'secondary' : 'ghost'} aria-pressed={width === 'full'} onClick={() => setWidth('full')}><Monitor size={16} aria-hidden /> Big screen</Button>
          <Button size="sm" variant={width === 'phone' ? 'secondary' : 'ghost'} aria-pressed={width === 'phone'} onClick={() => setWidth('phone')}><Smartphone size={16} aria-hidden /> Phone</Button>
        </div>
        <Button size="sm" loading={publishing} onClick={onPublish}>{isLive ? 'Publish changes' : 'Publish'}</Button>
      </header>
      <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-surface-2">
        <iframe title="Post preview" sandbox="allow-same-origin" srcDoc={srcDoc} className={clsx('h-full w-full border-0 bg-surface', width === 'phone' && 'md:my-3 md:h-[calc(100%-1.5rem)] md:w-[24.375rem] md:rounded-lg md:shadow-pop')} />
      </div>
    </div>
  );
}
