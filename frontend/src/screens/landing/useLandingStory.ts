import { useEffect, useState, type MutableRefObject } from 'react';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Pick the chapter whose section is most visible in the viewport center band. */
export function useActiveChapter(
  sectionRefs: MutableRefObject<(HTMLElement | null)[]>,
  sectionCount: number,
) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let observer: IntersectionObserver | undefined;
    let cancelled = false;

    const ratios = new Map<number, number>();

    const attach = () => {
      if (cancelled) return;
      const nodes = sectionRefs.current.slice(0, sectionCount).filter(Boolean) as HTMLElement[];
      if (nodes.length < sectionCount) {
        requestAnimationFrame(attach);
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const idx = Number(entry.target.getAttribute('data-chapter-index'));
            if (Number.isNaN(idx)) continue;
            ratios.set(idx, entry.intersectionRatio);
          }
          let best = 0;
          let bestRatio = -1;
          for (const [idx, ratio] of ratios) {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              best = idx;
            }
          }
          if (bestRatio > 0) setActiveIndex(best);
        },
        { root: null, rootMargin: '-35% 0px -35% 0px', threshold: [0, 0.15, 0.35, 0.55, 0.75, 1] },
      );

      nodes.forEach((node) => observer!.observe(node));
    };

    attach();

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [sectionCount, sectionRefs]);

  return activeIndex;
}

export function useParallaxScroll(containerRef: MutableRefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el || prefersReducedMotion()) {
      el?.style.setProperty('--landing-parallax', '0');
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const top = window.scrollY + rect.top;
      const height = el.offsetHeight;
      const view = window.innerHeight;
      const scrollRange = Math.max(height - view * 0.4, 1);
      const scrolled = window.scrollY - top;
      const p = Math.min(1, Math.max(0, scrolled / scrollRange));
      el.style.setProperty('--landing-parallax', p.toFixed(4));
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [containerRef]);
}
