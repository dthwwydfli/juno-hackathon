import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneFrame, StatusBar, AppHeader, BottomNav } from '../../components/Frame';
import { MedCard } from '../../components/MedCard';
import { SwipeToArchive } from '../../components/SwipeToArchive';
import { Icon } from '../../components/Icon';
import { useStore, useActiveMeds } from '../../data/store';
import { flaggedMedNames, refreshInteractions } from '../../lib/interactions';
import type { Category } from '../../data/types';
import './home.css';

const CATS: Category[] = ['NHS', 'Private', 'OTC'];

export function Home() {
  const nav = useNavigate();
  const { state, archiveMedication } = useStore();
  const active = useActiveMeds();
  const [tab, setTab] = useState<Category>('NHS');
  const [ixTick, setIxTick] = useState(0);

  useEffect(() => {
    void refreshInteractions(state.medications)
      .then(() => setIxTick((t) => t + 1))
      .catch(() => setIxTick((t) => t + 1));
  }, [state.medications]);

  const flagged = useMemo(
    () => flaggedMedNames(state.medications),
    [state.medications, ixTick],
  );
  const counts = useMemo(() => {
    const c: Record<Category, number> = { NHS: 0, Private: 0, OTC: 0 };
    for (const m of active) c[m.category] += 1;
    return c;
  }, [active]);

  const list = active.filter((m) => m.category === tab);

  return (
    <PhoneFrame label="Home">
      <StatusBar />
      <AppHeader title="Home" subtitle={`${active.length} medications · connected to NHS`} showHome={false} />

      <div className="segwrap">
        <div className="segment" role="tablist" aria-label="Filter medications by category">
          {CATS.map((c) => (
            <button key={c} role="tab" aria-selected={tab === c} onClick={() => setTab(c)}>
              {c} <span className="count">{counts[c]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="home-listbar">
        <span className="label">Medication list</span>
        {tab !== 'NHS' && (
          <span className="home-hint">Swipe a card to archive</span>
        )}
        <button className="home-archive" onClick={() => nav('/archive')}>
          <Icon name="archive" size={15} strokeWidth={1.9} />
          Archive
        </button>
      </div>

      <div className="screen-body">
        <div className="home-list">
          {list.map((m) => (
            <SwipeToArchive
              key={m.id}
              disabled={m.category === 'NHS'}
              onArchive={() => archiveMedication(m.id)}
            >
              <MedCard
                med={m}
                flagged={flagged.has(m.name.toLowerCase())}
                onEdit={() => nav(`/add/${m.id}`)}
                onWarning={() => nav('/interactions')}
              />
            </SwipeToArchive>
          ))}
          {list.length === 0 && <div className="home-empty">No {tab} medications yet.</div>}
        </div>
      </div>

      <BottomNav />
    </PhoneFrame>
  );
}
