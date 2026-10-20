import type { RichBlock } from '@/types/posts';

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Inline markdown: **bold**, *italic*, [link](url). Escaped first, then decorated. */
export function inlineMd(s: string): string {
  let e = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  e = e.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer ugc">$1</a>');
  e = e.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  e = e.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return e;
}

const linkOf = (b: RichBlock) => (b.link ? ` href="${b.link}" target="_blank" rel="noopener noreferrer ugc"` : '');

/** Blocks -> sanitised HTML. Only tags we generate; images keep their caption. */
export function blocksToHtml(blocks: RichBlock[]): string {
  return (blocks ?? []).map((b) => {
    const t = inlineMd(b.text ?? '');
    switch (b.type) {
      case 'h1': return `<h1>${t}</h1>`;
      case 'h2': return `<h2>${t}</h2>`;
      case 'quote': return `<blockquote>${t}</blockquote>`;
      case 'ul': return `<ul>${(b.items ?? []).map((i) => `<li>${inlineMd(i)}</li>`).join('')}</ul>`;
      case 'ol': return `<ol>${(b.items ?? []).map((i) => `<li>${inlineMd(i)}</li>`).join('')}</ol>`;
      case 'image': {
        const src = String(b.src ?? '').replace(/"/g, '');
        if (!src) return '';
        const img = b.link ? `<a${linkOf(b)}><img src="${src}" alt="${(b.caption ?? '').replace(/"/g, '')}" loading="lazy" /></a>` : `<img src="${src}" alt="${(b.caption ?? '').replace(/"/g, '')}" loading="lazy" />`;
        return `<figure>${img}${b.caption ? `<figcaption>${inlineMd(b.caption)}</figcaption>` : ''}</figure>`;
      }
      default: return t ? `<p>${t}</p>` : '';
    }
  }).join('');
}

/** Blocks -> plain text for search/translate. Images contribute their captions. */
export function blocksToText(blocks: RichBlock[]): string {
  return (blocks ?? []).map((b) => {
    if (b.type === 'ul' || b.type === 'ol') return (b.items ?? []).join('\n');
    if (b.type === 'image') return b.caption ?? '';
    return b.text ?? '';
  }).filter(Boolean).join('\n\n').slice(0, 20000);
}

/** Pasted / typed markdown -> blocks (headers, lists, images with captions, links stay inline). */
export function markdownToBlocks(md: string): RichBlock[] {
  const out: RichBlock[] = [];
  const lines = md.replace(/\r/g, '').split('\n');
  let ul: string[] = []; let ol: string[] = [];
  const flush = () => {
    if (ul.length) { out.push({ id: uid(), type: 'ul', items: ul }); ul = []; }
    if (ol.length) { out.push({ id: uid(), type: 'ol', items: ol }); ol = []; }
  };
  for (const line of lines) {
    const img = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*(?:\(([^)]*)\))?\s*$/);
    if (img) { flush(); out.push({ id: uid(), type: 'image', src: img[2], caption: img[1] || img[3] || '' }); continue; }
    if (/^#{1}\s+/.test(line)) { flush(); out.push({ id: uid(), type: 'paragraph', text: line.replace(/^#+\s*/, '') }); (out[out.length - 1] as RichBlock).type = 'h1'; continue; }
    if (/^#{2,}\s+/.test(line)) { flush(); out.push({ id: uid(), type: 'h2', text: line.replace(/^#+\s*/, '') }); continue; }
    if (/^>\s?/.test(line)) { flush(); out.push({ id: uid(), type: 'quote', text: line.replace(/^>\s?/, '') }); continue; }
    const o = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (o) { if (ul.length) { out.push({ id: uid(), type: 'ul', items: ul }); ul = []; } ol.push(o[1]); continue; }
    const u = line.match(/^\s*[-*+]\s+(.*)$/);
    if (u) { if (ol.length) { out.push({ id: uid(), type: 'ol', items: ol }); ol = []; } ul.push(u[1]); continue; }
    if (!line.trim()) { flush(); continue; }
    flush(); out.push({ id: uid(), type: 'paragraph', text: line });
  }
  flush();
  return out.length ? out : [{ id: uid(), type: 'paragraph', text: '' }];
}
