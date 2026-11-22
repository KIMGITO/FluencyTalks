import { useEffect, useRef, useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { ReactionButton } from '@/components/features/review/ReactionButton';
import { toggleLike } from '@/services/library';
import { useFeedCache } from '@/store/feedCache';
import { toast } from '@/store/toastStore';
import { userMessage } from '@/lib/errors';

/** A post's like, shared by the button and the phone menu. Changes at once, then settles on what the server says; goes back if it failed. */
export function useLike(postId: string, initialLiked?: boolean, initialCount?: number) {
  const [liked, setLiked] = useState(!!initialLiked);
  const [count, setCount] = useState(initialCount ?? 0);
  const busy = useRef(false);
  useEffect(() => { setLiked(!!initialLiked); setCount(initialCount ?? 0); }, [initialLiked, initialCount]);
  const toggle = async () => {
    if (busy.current) return;
    busy.current = true;
    const was = liked; const wasCount = count;
    setLiked(!was); setCount(Math.max(0, wasCount + (was ? -1 : 1)));
    try {
      const now = await toggleLike(postId);
      const n = Math.max(0, wasCount + (now === was ? 0 : now ? 1 : -1));
      setLiked(now); setCount(n);
      useFeedCache.getState().patchEverywhere(postId, { liked: now, like_count: n });
    } catch (e) { setLiked(was); setCount(wasCount); toast.error(userMessage(e, 'Could not like this post.')); } finally { busy.current = false; }
  };
  return { liked, count, toggle };
}

export function LikeButton({ like }: { like: ReturnType<typeof useLike> }) {
  return <ReactionButton icon={ThumbsUp} label={like.liked ? 'Liked' : 'Like'} ariaLabel={like.liked ? 'Unlike this post' : 'Like this post'} hideLabel
    count={like.count} active={like.liked} tone="accent" burst="sparks" onClick={() => void like.toggle()} />;
}
