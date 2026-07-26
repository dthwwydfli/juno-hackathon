import { useRef } from 'react';
import type { ReactNode } from 'react';
import { motion, useMotionValue, animate } from 'motion/react';
import { Icon } from './Icon';
import './swipe.css';

const ACTION_W = 96;    // width of the revealed archive action
const OPEN_THRESH = 46; // drag past this to latch open
const FLING = 400;      // px/s — a fast flick opens regardless of distance

/**
 * Swipe row: drag left to reveal an Archive action.
 * When `disabled`, renders children plainly (NHS meds auto-archive instead).
 *
 * Runs on Motion's drag rather than hand-rolled pointer maths. Besides feeling
 * better — velocity is taken into account, so a quick flick opens without
 * having to travel the full distance — this drops the previous version's
 * stale-closure bug, where `settle()` read `tx` from the render scope and could
 * latch against an out-of-date position.
 */
export function SwipeToArchive({ children, onArchive, disabled }: {
  children: ReactNode;
  onArchive: () => void;
  disabled?: boolean;
}) {
  const x = useMotionValue(0);
  const openRef = useRef(false);
  const draggedRef = useRef(false);

  if (disabled) return <>{children}</>;

  const settleTo = (open: boolean) => {
    openRef.current = open;
    animate(x, open ? -ACTION_W : 0, { duration: 0.24, ease: [0.32, 0.72, 0, 1] });
  };

  // Swallow the click that ends a drag, or close on a tap while latched open.
  // Motion does not do this for us, and without it a swipe would also fire the
  // row's tap handler.
  const onClickCapture = (e: React.MouseEvent) => {
    if (draggedRef.current) { e.stopPropagation(); e.preventDefault(); draggedRef.current = false; return; }
    if (openRef.current) { e.stopPropagation(); e.preventDefault(); settleTo(false); }
  };

  return (
    <div className="swipe-wrap">
      <button
        type="button"
        className="swipe-action"
        style={{ width: ACTION_W }}
        aria-label="Archive medication"
        onClick={() => { settleTo(false); onArchive(); }}
      >
        <Icon name="archive" size={20} />
        <span>Archive</span>
      </button>

      <motion.div
        className="swipe-front"
        style={{ x }}
        drag="x"
        // Locks to one axis from the first few pixels, so a vertical drag is
        // handed back to the list scroller instead of being eaten here.
        dragDirectionLock
        dragConstraints={{ left: -ACTION_W, right: 0 }}
        dragElastic={{ left: 0.04, right: 0 }}
        dragMomentum={false}
        onDragStart={() => { draggedRef.current = true; }}
        onDragEnd={(_, info) => {
          settleTo(info.offset.x < -OPEN_THRESH || info.velocity.x < -FLING);
        }}
        onClickCapture={onClickCapture}
      >
        {children}
      </motion.div>
    </div>
  );
}
