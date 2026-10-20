import clsx from 'clsx';
import { blocksToHtml } from '@/lib/blocks';
import type { RichBlock } from '@/types/posts';

/** Renders post blocks: headings, lists, links, quotes, captioned images. */
export function PostBody({ blocks, className, clamp }: { blocks: RichBlock[]; className?: string; clamp?: boolean }) {
  return (
    <div
      className={clsx('ft-post-body ft-selectable', clamp && 'ft-post-clamp', className)}
      dangerouslySetInnerHTML={{ __html: blocksToHtml(blocks ?? []) }}
    />
  );
}
