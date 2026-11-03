/**
 * What the whole app does around the phone keyboard. The browser only shrinks the "visual viewport" when the keyboard
 * opens, so this does the rest: the field being typed in moves into the space that is left, and when the keyboard goes
 * away the page returns to where it was. It publishes the space left as CSS variables on <html> (see index.css).
 */

const KEYBOARD_MIN_PX = 120;   // less than this is the address bar sliding, not a keyboard
const EDGE_GAP_PX = 12;   // measured positions must be final, so every scroll here is 'instant': public pages set smooth scrolling in CSS
const DRAG_PX = 10;
const SETTLE_MS = 180;         // browsers can still shift the page just after the keyboard has gone

type Saved = { path: string; spots: { el: Element; top: number }[]; windowY: number };

const isEditable = (el: Element | null): el is HTMLElement => {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !['checkbox', 'radio', 'file', 'range', 'color', 'button', 'submit', 'reset'].includes((el as HTMLInputElement).type);
};

const isScroller = (el: Element) => {
  const y = getComputedStyle(el).overflowY;
  return (y === 'auto' || y === 'scroll') && el.scrollHeight > el.clientHeight;
};

const scrollersAround = (el: Element) => {
  const list: Element[] = [];
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (isScroller(p)) list.push(p);
  return list;
};

const inFixedLayer = (el: Element) => {
  for (let p: Element | null = el; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') return true;
  return false;
};

/** How far to scroll so the target sits in the band: nothing if it already does, otherwise centred. Too tall to fit: its top shows. */
export function scrollDelta(target: { top: number; bottom: number }, band: { top: number; bottom: number }, gap = EDGE_GAP_PX): number {
  if (target.top >= band.top + gap && target.bottom <= band.bottom - gap) return 0;
  if (target.bottom - target.top >= band.bottom - band.top - 2 * gap) return target.top - band.top - gap;
  return (target.top + target.bottom) / 2 - (band.top + band.bottom) / 2;
}

/** A field's label comes with it. In a long rich-text field, what matters is the line being typed on. */
function targetOf(el: HTMLElement) {
  if (el.isContentEditable) {
    const sel = window.getSelection();
    const caret = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
    if (caret && (caret.top || caret.bottom)) return caret;
  }
  const label = el.closest('label');
  const box = el.getBoundingClientRect();
  const labelled = label?.getBoundingClientRect();
  return labelled && labelled.height < box.height + 80 ? { top: labelled.top, bottom: Math.max(labelled.bottom, box.bottom) } : box;
}

export function startKeyboardHandling() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  let fullHeight = 0;
  let open = false;
  let saved: Saved | null = null;
  let movedByHand = false;
  let settle = 0;

  const snapshot = (el: Element): Saved => ({
    path: window.location.pathname,
    windowY: window.scrollY,
    spots: scrollersAround(el).map((s) => ({ el: s, top: s.scrollTop })),
  });

  /** The screen left above the keyboard and below a header that stays in place. */
  const freeBand = (el: Element) => {
    let top = vv.offsetTop;
    const bottom = vv.offsetTop + vv.height;
    const header = document.querySelector('header');
    if (header && !inFixedLayer(el) && !el.closest('header')) {
      const position = getComputedStyle(header).position;
      if (position === 'sticky' || position === 'fixed') top = Math.max(top, header.getBoundingClientRect().bottom);
    }
    return { top, bottom };
  };

  const reveal = (el: HTMLElement) => {
    const band = freeBand(el);
    for (const scroller of scrollersAround(el)) {
      const box = scroller.getBoundingClientRect();
      scroller.scrollBy({ top: scrollDelta(targetOf(el), { top: Math.max(band.top, box.top), bottom: Math.min(band.bottom, box.bottom) }), behavior: 'instant' });
    }
    if (!inFixedLayer(el)) window.scrollBy({ top: scrollDelta(targetOf(el), band), behavior: 'instant' });
  };

  const restore = (to: Saved) => {
    for (const { el, top } of to.spots) if (el.isConnected) el.scrollTo({ top, behavior: 'instant' });
    window.scrollTo({ top: to.windowY, behavior: 'instant' });
  };

  const publish = () => {
    const bottom = window.innerHeight - (vv.offsetTop + vv.height);
    root.style.setProperty('--ft-vv-top', `${vv.offsetTop}px`);
    root.style.setProperty('--ft-vv-bottom', `${Math.max(0, bottom)}px`);
    root.style.setProperty('--ft-kb', `${Math.max(0, fullHeight - vv.height)}px`);
  };

  const onViewportChange = () => {
    fullHeight = Math.max(fullHeight, window.innerHeight, vv.height);
    const active = document.activeElement;
    const isOpen = vv.scale <= 1.01 && fullHeight - vv.height > KEYBOARD_MIN_PX && (open || isEditable(active));
    if (isOpen) {
      if (!open) {
        window.clearTimeout(settle);
        if (!saved && isEditable(active)) saved = snapshot(active);
        movedByHand = false;
        open = true;
        root.classList.add('ft-keyboard');
      }
      publish();
      if (isEditable(active) && !movedByHand) reveal(active);
    } else if (open) {
      open = false;
      root.classList.remove('ft-keyboard');
      const to = saved;
      saved = null;
      if (to && !movedByHand && to.path === window.location.pathname) {
        restore(to);
        settle = window.setTimeout(() => { if (!open && !movedByHand) restore(to); }, SETTLE_MS);
      }
    }
  };

  vv.addEventListener('resize', onViewportChange);
  vv.addEventListener('scroll', () => { if (open) publish(); });
  window.addEventListener('orientationchange', () => { fullHeight = 0; });
  // A finger that really dragged: the person chose where to look, so the page stays there. A tap wobbles a few pixels.
  let touchY = 0;
  document.addEventListener('touchstart', (e) => { touchY = e.touches[0]?.clientY ?? 0; }, { passive: true });
  document.addEventListener('touchmove', (e) => { if (Math.abs((e.touches[0]?.clientY ?? touchY) - touchY) > DRAG_PX) movedByHand = true; }, { passive: true });
  document.addEventListener('focusin', ({ target }) => {
    if (!isEditable(target as Element)) return;
    if (open) { movedByHand = false; reveal(target as HTMLElement); }
    // Taken now: by the time the viewport reports the keyboard, the browser may already have moved the page.
    else saved = snapshot(target as Element);
  });
}
