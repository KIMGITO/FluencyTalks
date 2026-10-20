import { useState } from 'react';
import clsx from 'clsx';
import { blocksToHtml } from '@/lib/blocks';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import type { RichBlock } from '@/types/posts';

/** Renders post blocks: headings, lists, links, quotes, captioned images.
 *  Tapping an image opens it whole (never cropped) in a lightbox. */
export function PostBody({ blocks, className, clamp }: { blocks: RichBlock[]; className?: string; clamp?: boolean }) {
  const [img, setImg] = useState<{ src: string; alt?: string; caption?: string } | null>(null);
  const onBodyClick = (e: React.MouseEvent) => {
    const image = (e.target as HTMLElement).closest?.('img');
    if (!image) return;
    const figure = image.closest('figure');
    setImg({ src: image.src, alt: image.alt ?? undefined, caption: figure?.querySelector('figcaption')?.textContent ?? undefined });
  };
  return (
    <>
      <div
        className={clsx('ft-post-body ft-selectable', clamp && 'ft-post-clamp', className)}
        onClick={onBodyClick}
        dangerouslySetInnerHTML={{ __html: blocksToHtml(blocks ?? []) }}
      />
      {img && <ImageLightbox open={img !== null} onClose={() => setImg(null)} src={img.src} alt={img.alt} caption={img.caption} />}
    </>
  );
}
