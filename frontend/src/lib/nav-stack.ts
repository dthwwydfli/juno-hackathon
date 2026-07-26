import { useRef } from 'react';
import { matchPath, useLocation, useNavigationType } from 'react-router-dom';

/**
 * Which way a screen transition should travel.
 *
 * `useNavigationType()` on its own gets this wrong here: Add's close button and
 * AppHeader's Home button both call `nav('/home')`, which the router reports as
 * PUSH even though it is semantically a pop. So depth is the primary signal and
 * navigation type is only the tiebreaker.
 */

/** Route → stack depth. Siblings at the same depth cross-fade rather than
 *  slide, which is what a native tab bar does. */
const DEPTH: [string, number][] = [
  ['/', 0],
  ['/auth', 1],
  ['/onboarding', 2],
  // Bottom-nav siblings
  ['/home', 3],
  ['/interactions', 3],
  ['/share', 3],
  // Pushed from the tab level
  ['/add', 4],
  ['/add/:id', 4],
  ['/settings', 4],
  ['/archive', 4],
  ['/interactions/:id', 4],
  ['/settings/nhs', 5],
];

export function depthOf(pathname: string): number {
  for (const [pattern, depth] of DEPTH) {
    if (matchPath({ path: pattern, end: true }, pathname)) return depth;
  }
  return 3;
}

/** -1 = pop (slide right), 1 = push (slide left), 0 = sibling (cross-fade). */
export function useNavDirection(): -1 | 0 | 1 {
  const location = useLocation();
  const type = useNavigationType();
  const prev = useRef(location.pathname);
  const dir = useRef<-1 | 0 | 1>(0);

  if (prev.current !== location.pathname) {
    const delta = depthOf(location.pathname) - depthOf(prev.current);
    const forced = (location.state as { navDir?: -1 | 0 | 1 } | null)?.navDir;
    dir.current =
      forced ??
      (delta !== 0 ? ((delta > 0 ? 1 : -1) as -1 | 1) : type === 'POP' ? -1 : 0);
    prev.current = location.pathname;
  }

  // StrictMode's double render is safe: the second pass sees prev === pathname.
  return dir.current;
}
