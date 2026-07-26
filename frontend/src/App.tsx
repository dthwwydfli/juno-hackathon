import type { ReactNode } from 'react';
import { Routes, Route, matchPath, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import { PhoneShell } from './components/Frame';
import { useNavDirection } from './lib/nav-stack';
import { Landing } from './screens/landing/Landing';
import { Auth } from './screens/auth/Auth';
import { Onboarding } from './screens/onboarding/Onboarding';
import { Home } from './screens/home/Home';
import { Add } from './screens/add/Add';
import { Interactions } from './screens/interactions/Interactions';
import { ReadMore } from './screens/readmore/ReadMore';
import { Share } from './screens/share/Share';
import { Settings } from './screens/settings/Settings';
import { NhsConnection } from './screens/nhs-connection/NhsConnection';
import { Archive } from './screens/archive/Archive';
import { GpShareView } from './screens/gp/GpShareView';
import { NotFound } from './screens/not-found/NotFound';

/** Push slides in from the right; pop slides back out with the iOS parallax —
 *  the outgoing screen drifts only 28%, not a full width, which is what makes
 *  it read as a stack rather than a carousel. */
const variants = {
  enter: (d: number) => (d === 0 ? { opacity: 0, x: '0%' } : { opacity: 1, x: `${d * 100}%` }),
  center: { opacity: 1, x: '0%' },
  exit: (d: number) => (d === 0 ? { opacity: 0, x: '0%' } : { opacity: 0.6, x: `${d * -28}%` }),
};

function ScreenLayer({ children, custom }: { children: ReactNode; custom: number }) {
  const present = useIsPresent();
  return (
    <motion.div
      className="screen-layer"
      custom={custom}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
      // The outgoing screen is still in the DOM for 420ms; keep it out of the
      // tab order and away from the pointer while it leaves.
      style={{ zIndex: present ? 2 : 1, pointerEvents: present ? 'auto' : 'none' }}
      inert={!present}
      aria-hidden={!present}
    >
      {children}
    </motion.div>
  );
}

function ScreenStack() {
  const location = useLocation();
  const dir = useNavDirection();
  const reduce = useReducedMotion();
  // Reduced motion selects the dir === 0 variants, i.e. a cross-fade. Letting
  // MotionConfig flatten the slide instead would produce an abrupt cut.
  const custom = reduce ? 0 : dir;

  return (
    // `custom` must be on both the presence wrapper and the layer, or the
    // EXITING child animates with the direction it mounted with.
    <AnimatePresence initial={false} custom={custom}>
      <ScreenLayer key={location.pathname} custom={custom}>
        {/* The explicit location is essential: without it the outgoing copy
            re-resolves through router context and renders the NEW screen, so
            you watch a screen slide out from under itself. */}
        <Routes location={location}>
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/home" element={<Home />} />
          <Route path="/add" element={<Add />} />
          <Route path="/add/:id" element={<Add />} />
          <Route path="/interactions" element={<Interactions />} />
          <Route path="/interactions/:id" element={<ReadMore />} />
          <Route path="/share" element={<Share />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/nhs" element={<NhsConnection />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ScreenLayer>
    </AnimatePresence>
  );
}

function gpTokenFromSearch(search: string): string | undefined {
  const fromRouter = new URLSearchParams(search).get('gp')?.trim();
  if (fromRouter) return fromRouter;
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('gp')?.trim() ?? undefined;
  }
  return undefined;
}

export default function App() {
  const location = useLocation();
  const gpFromQuery = gpTokenFromSearch(location.search);
  if (location.pathname === '/' && gpFromQuery) {
    return (
      <PhoneShell>
        <GpShareView />
      </PhoneShell>
    );
  }

  const gpMatch = matchPath({ path: '/gp/:token', end: true }, location.pathname);
  if (gpMatch) {
    return (
      <PhoneShell>
        <Routes>
          <Route path="/gp/:token" element={<GpShareView />} />
        </Routes>
      </PhoneShell>
    );
  }

  // Landing is a full-width marketing page with no phone frame, so it sits
  // outside both the shell and the stack.
  if (location.pathname === '/') return <Landing />;
  return (
    <PhoneShell>
      <ScreenStack />
    </PhoneShell>
  );
}
