import { useEffect, useRef } from 'react';

interface SwipeHandlers {
  onSwipeRight: () => void;
  onLongPress: () => void;
}

/**
 * Pure touch/pointer gesture hook: no new deps.
 * - Horizontal right swipe (>56px, mostly horizontal) -> reply.
 * - Long press (>=550ms, <10px move) -> context action sheet.
 * Desktop hover menus are CSS-driven in MessageBubble (no JS needed).
 */
export function useMessageGestures(ref: { current: HTMLElement | null }, { onSwipeRight, onLongPress }: SwipeHandlers) {
  const state = useRef({ startX: 0, startY: 0, dx: 0, timer: 0 as unknown as ReturnType<typeof setTimeout> | 0, fired: false, el: null as HTMLElement | null });
  const cb = useRef({ onSwipeRight, onLongPress });
  cb.current = { onSwipeRight, onLongPress };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = state.current;
    s.el = el;

    const clearTimer = () => { if (s.timer) { clearTimeout(s.timer); s.timer = 0; } };
    const down = (x: number, y: number) => {
      s.startX = x; s.startY = y; s.dx = 0; s.fired = false;
      clearTimer();
      s.timer = setTimeout(() => { s.fired = true; el.style.transform = ''; cb.current.onLongPress(); }, 550);
    };
    const move = (x: number, y: number) => {
      const dx = x - s.startX; const dy = y - s.startY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) clearTimer();
      if (Math.abs(dy) > Math.abs(dx) * 1.2) { el.style.transform = ''; s.dx = 0; return; }   // vertical scroll wins
      if (dx > 0) { s.dx = Math.min(dx, 88); el.style.transform = `translateX(${s.dx}px)`; }
      else { el.style.transform = ''; s.dx = 0; }
    };
    const up = () => {
      clearTimer();
      const fired = s.fired;
      el.style.transition = 'transform 160ms ease';
      el.style.transform = '';
      setTimeout(() => { if (s.el) s.el.style.transition = ''; }, 170);
      if (!fired && s.dx > 56) cb.current.onSwipeRight();
      s.dx = 0; s.fired = false;
    };

    const onTouchStart = (e: TouchEvent) => { const t = e.touches[0]; down(t.clientX, t.clientY); };
    const onTouchMove = (e: TouchEvent) => { const t = e.touches[0]; move(t.clientX, t.clientY); };
    const onTouchEnd = () => up();
    const onContext = (e: Event) => { if ('vibrate' in navigator) { try { (navigator as Navigator & { vibrate: (p: number) => boolean }).vibrate(12); } catch { /* noop */ } } e.preventDefault?.(); };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    el.addEventListener('contextmenu', onContext);
    return () => {
      clearTimer();
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('contextmenu', onContext);
    };
  }, [ref]);
}
