import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneFrame, StatusBar, AppHeader, BottomNav } from '../../components/Frame';
import { Icon, iconForRoute } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useStore, useActiveMeds } from '../../data/store';
import { getInteractionRefreshError, refreshInteractions } from '../../lib/interactions';
import { formatApiReachabilityError } from '../../lib/api';
import type { Category, Interaction } from '../../data/types';
import './interactions.css';

function Swap({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 8h11M7 8l3-3M7 8l3 3" />
      <path d="M17 16H6M17 16l-3-3M17 16l-3 3" />
    </svg>
  );
}

function Stethoscope({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3v6a6 6 0 0 0 12 0V3" />
      <path d="M4 3h4M16 3h4" />
      <path d="M18 15a3 3 0 0 1 3 3v1a3 3 0 0 1-6 0" />
    </svg>
  );
}

function Pill({ name, brand, category, icon }: { name: string; brand: string; category: Category; icon: IconName }) {
  return (
    <div className="ix-pill">
      <span className="ix-ic"><Icon name={icon} size={18} /></span>
      <span className="ix-pcol">
        <span className="ix-pn">{name}</span>
        <span className="ix-pt">{brand} · {category}</span>
      </span>
    </div>
  );
}

export function Interactions() {
  const nav = useNavigate();
  const { state } = useStore();
  const active = useActiveMeds();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setInteractions([]);
    refreshInteractions(state.medications)
      .then((list) => {
        if (live) {
          setInteractions(list);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (live) {
          setError(formatApiReachabilityError(e) || getInteractionRefreshError() || 'Interaction check failed');
          setLoading(false);
        }
      });
    return () => { live = false; };
  }, [state.medications]);

  useEffect(() => runCheck(), [runCheck]);

  const info = useMemo(() => {
    const map = new Map<string, { brand: string; icon: IconName }>();
    for (const m of active) {
      map.set(m.name.toLowerCase(), { brand: m.brand, icon: iconForRoute(m.route) });
    }
    return map;
  }, [active]);

  const pillProps = (medName: string, category: Category) => {
    const meta = info.get(medName.toLowerCase());
    return { name: medName, brand: meta?.brand ?? medName, category, icon: meta?.icon ?? ('pill' as IconName) };
  };

  return (
    <PhoneFrame label="Interactions">
      <StatusBar />
      <AppHeader title="Interactions" subtitle={`Checked across your ${active.length} medications`} />

      <div className="ix-label">
        <span>Potential interactions</span>
        {interactions.length > 0 && <span className="lcount">{interactions.length} found</span>}
      </div>
      <div className="screen-body">
        <div className="ix-list">
          {loading ? (
            <div className="ix-clear">
              <span className="ci"><Icon name="sync" size={18} strokeWidth={2} /></span>
              <div>
                <div className="c1">Checking interactions…</div>
                <div className="c2">MedData and Supp.AI via server</div>
              </div>
            </div>
          ) : error ? (
            <div className="ix-clear">
              <span className="ci"><Icon name="warning" size={18} strokeWidth={2} /></span>
              <div>
                <div className="c1">Could not check interactions</div>
                <div className="c2">{error}</div>
                <button type="button" className="ix-readmore" style={{ marginTop: 12 }} onClick={() => runCheck()}>
                  Retry
                </button>
              </div>
            </div>
          ) : interactions.length === 0 ? (
            <div className="ix-clear">
              <span className="ci"><Icon name="check" size={18} strokeWidth={2.2} /></span>
              <div>
                <div className="c1">No interactions found</div>
                <div className="c2">We didn’t spot any interactions across your current medications.</div>
              </div>
            </div>
          ) : (
            interactions.map((it) => (
              <div key={it.id} className="ix-card">
                <div className="pad">
                  <div className="ix-sevrow">
                    <span className="ix-tri"><Icon name="warning" size={16} strokeWidth={2} /></span>
                    <span className="ix-sevchip">Potential interaction</span>
                    <span className="ix-tag">{it.aCategory} × {it.bCategory}</span>
                  </div>
                  <div className="ix-pair">
                    <Pill {...pillProps(it.a, it.aCategory)} />
                    <span className="ix-swap"><Swap /></span>
                    <Pill {...pillProps(it.b, it.bCategory)} />
                  </div>
                  <div className="ix-reason">{it.reason}</div>
                </div>
                <button className="ix-readmore" onClick={() => nav(`/interactions/${it.id}`)}>
                  <span className="r"><Icon name="info" size={17} strokeWidth={1.9} /> Read more information</span>
                  <Icon name="chevron" size={19} strokeWidth={1.9} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="ix-gp">
        <span className="gi"><Stethoscope /></span>
        <div className="gt">
          Please discuss with your GP
          <small>This is guidance only — don’t stop or change any medicine on your own.</small>
        </div>
      </div>

      <BottomNav active="interactions" />
    </PhoneFrame>
  );
}
