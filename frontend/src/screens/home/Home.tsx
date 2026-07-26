import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneFrame, StatusBar, AppHeader, BottomNav } from '../../components/Frame';
import { useCondense } from '../../components/useCondense';
import { MedCard } from '../../components/MedCard';
import { PillGlyph } from '../../components/PillGlyph';
import { motion, AnimatePresence } from 'motion/react';
import { nextDose, formatUntil, formatClock } from '../../lib/schedule';
import { SwipeToArchive } from '../../components/SwipeToArchive';
import { Icon } from '../../components/Icon';
import { useStore, useActiveMeds } from '../../data/store';
import {
  flaggedMedNames,
  refreshInteractions,
  getIncompleteCheckReason,
  getInteractionRefreshError,
  getStaleInteractionReason,
} from '../../lib/interactions';
import { getLiveRefreshState } from '../../lib/interaction-cache';
import type { Category } from '../../data/types';
import './home.css';

const CATS: Category[] = ['NHS', 'Private', 'OTC'];

export function Home() {
  const nav = useNavigate();
  const { state, archiveMedication } = useStore();
  const active = useActiveMeds();
  const [tab, setTab] = useState<Category>('NHS');
  const [ixTick, setIxTick] = useState(0);
  const { ref: scrollRef, condensed } = useCondense();

  useEffect(() => {
    let cancelled = false;
    setIxTick((t) => t + 1);
    void refreshInteractions(state.medications)
      .then(() => {
        if (!cancelled) setIxTick((t) => t + 1);
      })
      .catch(() => {
        if (!cancelled) setIxTick((t) => t + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [state.medications]);

  const ixLoading = useMemo(() => {
    void ixTick;
    return getLiveRefreshState() === 'loading';
  }, [ixTick, state.medications]);

  const flagged = useMemo(
    () => flaggedMedNames(state.medications),
    [state.medications, ixTick],
  );

  const ixNotice = useMemo(() => {
    void ixTick;
    if (getLiveRefreshState() === 'loading') return null;
    const stale = getStaleInteractionReason();
    if (stale) {
      return `Showing last known interactions. ${stale}`;
    }
    if (getLiveRefreshState() === 'error') {
      return getInteractionRefreshError() || 'Interaction check failed.';
    }
    return getIncompleteCheckReason();
  }, [ixTick, state.medications]);

  const counts = useMemo(() => {
    const c: Record<Category, number> = { NHS: 0, Private: 0, OTC: 0 };
    for (const m of active) c[m.category] += 1;
    return c;
  }, [active]);

  const list = active.filter((m) => m.category === tab);

  // Recomputed per render rather than on a timer: the relative label only needs
  // to be right when the screen is looked at, and a ticking interval on Home
  // would re-render the whole list every minute for no visible gain.
  const upcoming = useMemo(() => nextDose(active), [active]);

  return (
    <PhoneFrame label="Home">
      <StatusBar />
      <AppHeader title="Home" subtitle={`${active.length} medications · connected to NHS`} showHome={false} condensed={condensed} />

      {/* What you take next, not just what you take. This is the one element on
          the screen that could only belong to this person, right now. */}
      {upcoming && (
        <div className="home-next">
          <div className="home-next-label">
            <span>Next dose</span>
            <span className="home-next-when">{formatUntil(upcoming)}</span>
          </div>
          <div className="home-next-body">
            <PillGlyph name={upcoming.med.name} form={upcoming.med.form} size={34} />
            <div className="home-next-text">
              <span className="home-next-name">{upcoming.med.name}</span>
              <span className="home-next-meta">
                <span className="num">{upcoming.dose}</span>
                <span className="dot" />
                <span className="num">{formatClock(upcoming.minutes)}</span>
                {upcoming.tomorrow && ' tomorrow'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="segwrap">
        <div
          className="segment"
          role="tablist"
          aria-label="Filter medications by category"
          style={{ '--seg-i': CATS.indexOf(tab), '--seg-n': CATS.length } as CSSProperties}
        >
          {CATS.map((c) => (
            <button key={c} role="tab" aria-selected={tab === c} onClick={() => setTab(c)}>
              {c} <span className="count">{counts[c]}</span>
            </button>
          ))}
        </div>
      </div>

      {ixLoading && (
        <div className="home-ix-banner home-ix-loading" role="status">
          <Icon name="sync" size={17} strokeWidth={2} className="spin" />
          <span>Checking interactions…</span>
        </div>
      )}

      {!ixLoading && ixNotice && (
        <div className="home-ix-banner" role="status">
          <Icon name="warning" size={17} strokeWidth={2} />
          <div>
            {ixNotice}
            <button type="button" onClick={() => nav('/interactions')}>
              Open Interactions
            </button>
          </div>
        </div>
      )}

      <div className="home-listbar">
        <span className="label">Medication list</span>
        {tab !== 'NHS' && (
          <span className="home-hint">Swipe a card to archive</span>
        )}
        <button className="home-archive" onClick={() => nav('/archive')}>
          <Icon name="archive" size={15} strokeWidth={1.8} />
          Archive
        </button>
      </div>

      <div className="screen-body" ref={scrollRef}>
        {/* Two levels of presence: the outer one makes a segment change read as
            a single movement, the inner one lets an archived row leave on its
            own while the rows below close the gap. The CSS `.stagger` class is
            deliberately NOT used here — a running CSS animation wins over
            Motion's inline transform and the two would fight for 420ms. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="home-list"
            key={tab}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
          {list.length > 0 && (
            <div className="list-group">
              <AnimatePresence initial={false} mode="popLayout">
                {list.map((m, i) => (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                    animate={{
                      opacity: 1, y: 0, filter: 'blur(0px)',
                      transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1], delay: Math.min(i, 9) * 0.04 },
                    }}
                    exit={{ opacity: 0, x: -60, transition: { duration: 0.18 } }}
                  >
                    <SwipeToArchive
                      disabled={m.category === 'NHS'}
                      onArchive={() => archiveMedication(m.id)}
                    >
                      <MedCard
                        med={m}
                        variant="row"
                        flagged={flagged.has(m.name.toLowerCase())}
                        onEdit={() => nav(`/add/${m.id}`)}
                        onWarning={() => nav('/interactions')}
                      />
                    </SwipeToArchive>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          {list.length === 0 && (
            <div className="empty-state">
              <span className="es-icon"><Icon name="pill" size={28} strokeWidth={1.6} /></span>
              <span className="es-title">No {tab} medications yet</span>
              <span className="es-text">
                {tab === 'NHS'
                  ? 'Prescriptions pulled from your NHS record will appear here.'
                  : `Tap Add to log a ${tab} medicine.`}
              </span>
            </div>
          )}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNav interactionsAlert={Boolean(ixNotice)} />
    </PhoneFrame>
  );
}
