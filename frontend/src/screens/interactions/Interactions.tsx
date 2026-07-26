import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneFrame, StatusBar, AppHeader, BottomNav } from '../../components/Frame';
import { Icon } from '../../components/Icon';
import { PillGlyph } from '../../components/PillGlyph';
import { useStore, useActiveMeds } from '../../data/store';
import {
  getIncompleteCheckReason,
  getInteractionRefreshError,
  getStaleInteractionReason,
  refreshInteractions,
} from '../../lib/interactions';
import { formatApiReachabilityError } from '../../lib/api';
import type { Category, Interaction, MedForm } from '../../data/types';
import './interactions.css';

function Swap({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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

function Pill({ name, brand, category, form }: { name: string; brand: string; category: Category; form: MedForm }) {
  return (
    <div className="ix-pill">
      {/* Same glyph and colour the medication has on Home, so a pair reads as
          "the purple one and the peach one" rather than two identical icons. */}
      <span className="ix-ic"><PillGlyph name={name} form={form} size={26} /></span>
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
  const [partial, setPartial] = useState<string | null>(null);

  const runCheck = useCallback((force = false) => {
    let live = true;
    setLoading(true);
    setError(null);
    setPartial(null);
    setInteractions([]);
    refreshInteractions(state.medications, { force })
      .then((list) => {
        if (live) {
          // An empty list only means "all clear" when every source answered.
          // A dead or rate-limited API must not read as a clean bill of health,
          // and partial results must say which source was missing.
          const problem = getIncompleteCheckReason();
          const stale = getStaleInteractionReason();
          if (problem && list.length === 0) setError(problem);
          else if (stale && list.length > 0) setPartial(stale);
          else if (problem) setPartial(problem);
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
    const map = new Map<string, { brand: string; form: MedForm }>();
    for (const m of active) {
      map.set(m.name.toLowerCase(), { brand: m.brand, form: m.form });
    }
    return map;
  }, [active]);

  const pillProps = (medName: string, category: Category) => {
    const meta = info.get(medName.toLowerCase());
    return { name: medName, brand: meta?.brand ?? medName, category, form: meta?.form ?? ('other' as MedForm) };
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
        <div className="ix-list stagger">
          {!loading && !error && partial && (
            <div className="ix-partial" role="status">
              <Icon name="warning" size={15} strokeWidth={2} />
              <span>Some sources were unavailable, so this list may be incomplete. {partial}</span>
            </div>
          )}
          {loading ? (
            <>
              <div className="ix-clear">
                <span className="ci"><Icon name="sync" size={18} strokeWidth={2} className="spin" /></span>
                <div>
                  <div className="c1">Checking interactions…</div>
                </div>
              </div>
              {/* Placeholder cards so the list has shape while the check runs,
                  instead of a single line of text on an empty screen. */}
              <div className="ix-skel" aria-hidden>
                <div className="skel" style={{ height: 44 }} />
                <div className="skel" style={{ height: 62 }} />
                <div className="skel" style={{ height: 34, width: '70%' }} />
              </div>
            </>
          ) : error ? (
            <div className="ix-clear">
              <span className="ci"><Icon name="warning" size={18} strokeWidth={2} /></span>
              <div>
                <div className="c1">Could not check interactions</div>
                <div className="c2">{error}</div>
                <button type="button" className="ix-retry" onClick={() => runCheck(true)}>
                  Retry
                </button>
              </div>
            </div>
          ) : interactions.length === 0 ? (
            <div className="ix-clear">
              <span className="ci"><Icon name="check" size={18} strokeWidth={2} /></span>
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
                  <span className="r"><Icon name="info" size={17} strokeWidth={1.8} /> Read more information</span>
                  <Icon name="chevron" size={19} strokeWidth={1.8} />
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
          <small>This is guidance only. Don’t stop or change any medicine on your own.</small>
        </div>
      </div>

      <BottomNav active="interactions" />
    </PhoneFrame>
  );
}
