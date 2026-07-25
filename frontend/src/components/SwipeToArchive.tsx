import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import './swipe.css';

const ACTION_W = 96;   // width of the revealed archive action
const OPEN_THRESH = 46; // drag past this to latch open
const MOVE_THRESH = 7;  // horizontal px before we treat it as a swipe (vs a tap)

/** WhatsApp-style swipe row: drag left to reveal an Archive action.
 *  When `disabled`, renders children plainly (used for NHS meds, which auto-archive). */
export function SwipeToArchive({ children, onArchive, disabled }: {
  children: ReactNode;
  onArchive: () => void;
  disabled?: boolean;
}) {
  const [tx, setTx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const openRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);

  if (disabled) return <>{children}</>;

  const onPointerDown = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const ddx = e.clientX - startRef.current.x;
    const ddy = e.clientY - startRef.current.y;
    if (!movedRef.current) {
      if (Math.abs(ddx) > MOVE_THRESH && Math.abs(ddx) > Math.abs(ddy)) {
        movedRef.current = true;
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
      } else {
        return;
      }
    }
    const base = openRef.current ? -ACTION_W : 0;
    setTx(Math.max(-ACTION_W, Math.min(0, base + ddx)));
  };
  const settle = () => {
    startRef.current = null;
    setDragging(false);
    if (movedRef.current) {
      openRef.current = tx < -OPEN_THRESH;
      setTx(openRef.current ? -ACTION_W : 0);
    }
  };
  const close = () => { openRef.current = false; setTx(0); };

  // Swallow the click that ends a drag, or close on a tap while open.
  const onClickCapture = (e: React.MouseEvent) => {
    if (movedRef.current) { e.stopPropagation(); e.preventDefault(); movedRef.current = false; return; }
    if (openRef.current) { e.stopPropagation(); e.preventDefault(); close(); }
  };

  return (
    <div className="swipe-wrap">
      <button
        type="button"
        className="swipe-action"
        style={{ width: ACTION_W }}
        aria-label="Archive medication"
        onClick={() => { close(); onArchive(); }}
      >
        <Icon name="archive" size={20} />
        <span>Archive</span>
      </button>
      <div
        className={`swipe-front${dragging ? ' dragging' : ''}`}
        style={{ transform: `translateX(${tx}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={settle}
        onPointerCancel={settle}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
