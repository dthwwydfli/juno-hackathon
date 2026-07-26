import { useEffect, useRef, useState } from 'react';

/**
 * Tracks whether a `.screen-body` has been scrolled, so a large title can
 * condense into a compact one the way an iOS navigation bar does.
 *
 * The scroller is the element itself rather than the window — the app renders
 * inside a fixed-height phone frame, so `window.scrollY` never moves.
 */
export function useCondense(threshold = 10) {
  const ref = useRef<HTMLDivElement>(null);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setCondensed(el.scrollTop > threshold));
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return { ref, condensed };
}
