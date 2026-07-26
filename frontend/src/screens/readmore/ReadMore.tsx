import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PhoneFrame, StatusBar, SubHeader } from '../../components/Frame';
import { Icon, iconForRoute } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useActiveMeds } from '../../data/store';
import { getInteractionById } from '../../lib/interactions';
import type { Category } from '../../data/types';
import './readmore.css';

function Swap({ size = 24 }: { size?: number }) {
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

/** Cylinder / database glyph for the API source card. */
function Database({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  );
}

/** Small illustrative glyph per affected-system label; label-only fallback. */
function affectPath(label: string): React.ReactNode {
  const key = label.toLowerCase();
  if (key.includes('blood pressure')) return <path d="M3 12h4l2 5 4-12 2 7h6" />;
  if (key.includes('kidney')) return <path d="M12 3s6 5.5 6 10a6 6 0 0 1-12 0c0-4.5 6-10 6-10z" />;
  if (key.includes('fluid')) return <path d="M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />;
  if (key.includes('stomach')) return <><path d="M8 4c3 0 3 3 5 3s2-1 3-1a3 3 0 0 1 0 6c-1 4-3 8-7 8a5 5 0 0 1-5-5c0-6 2-11 6-11z" /></>;
  if (key.includes('bleed')) return <path d="M12 3s6 5.5 6 10a6 6 0 0 1-12 0c0-4.5 6-10 6-10z" />;
  return <circle cx="12" cy="12" r="8" />;
}

function Pill({ name, brand, category, icon }: { name: string; brand: string; category: Category; icon: IconName }) {
  return (
    <div className="rm-pill">
      <span className="rm-ic"><Icon name={icon} size={18} /></span>
      <span className="rm-pcol">
        <span className="rm-pn">{name}</span>
        <span className="rm-pt">{brand} · {category}</span>
      </span>
    </div>
  );
}

export function ReadMore() {
  const { id } = useParams();
  const nav = useNavigate();
  const active = useActiveMeds();
  const it = id ? getInteractionById(id) : undefined;

  const info = useMemo(() => {
    const map = new Map<string, { brand: string; icon: IconName }>();
    for (const m of active) map.set(m.name.toLowerCase(), { brand: m.brand, icon: iconForRoute(m.route) });
    return map;
  }, [active]);

  if (!it) {
    return (
      <PhoneFrame label="Interaction detail">
        <StatusBar />
        <SubHeader title="Interaction detail" />
        <div className="screen-body">
          <div className="rm-fallback">
            That interaction couldn’t be found.
            <br />
            <button className="btn ghost" onClick={() => nav('/interactions')}>Back to interactions</button>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  const pillProps = (medName: string, category: Category) => {
    const meta = info.get(medName.toLowerCase());
    return { name: medName, brand: meta?.brand ?? medName, category, icon: meta?.icon ?? ('pill' as IconName) };
  };

  return (
    <PhoneFrame label="Interaction detail">
      <StatusBar />
      <SubHeader title="Interaction detail" />

      <div className="screen-body">
        <div className="rm-body">

          {/* hero risk cue */}
          <div className="rm-hero">
            <div className="rm-hrow">
              <span className="rm-htri"><Icon name="warning" size={18} strokeWidth={2} /></span>
              <span className="rm-hlabel">Potential interaction</span>
            </div>
            <div className="rm-pair">
              <Pill {...pillProps(it.a, it.aCategory)} />
              <span className="rm-swap"><Swap /></span>
              <Pill {...pillProps(it.b, it.bCategory)} />
            </div>
          </div>

          {/* what happens */}
          <div className="rm-sec">
            <div className="rm-sh">What happens</div>
            <div className="rm-para">{it.detail}</div>
          </div>

          {/* what it may affect */}
          <div className="rm-sec">
            <div className="rm-sh">What it may affect</div>
            <div className="rm-affects">
              {it.affects.map((a) => (
                <span key={a.label} className="rm-affect">
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {affectPath(a.label)}
                  </svg>
                  {a.label}
                </span>
              ))}
            </div>
          </div>

          {/* good to know */}
          <div className="rm-sec">
            <div className="rm-sh">Good to know</div>
            <div className="rm-bullets">
              {it.goodToKnow.map((g, i) => (
                <div key={i} className="rm-bul">
                  <span className="rm-bi"><Icon name="check" size={14} strokeWidth={2.2} /></span>
                  {g}
                </div>
              ))}
            </div>
          </div>

          {/* source attribution */}
          <div className="rm-source">
            <span className="rm-si"><Database /></span>
            <div>
              <div className="rm-s1">{it.source} medicines information</div>
              <div className="rm-s2">Retrieved via healthcare API · 25 Jul 2026</div>
            </div>
            <span className="rm-verified"><Icon name="check" size={12} strokeWidth={2.4} /> Verified</span>
          </div>

        </div>
      </div>

      {/* GP note */}
      <div className="rm-gp">
        <span className="gi"><Stethoscope /></span>
        <div className="gt">
          Please discuss with your GP
          <small>Information only. This isn’t medical advice or a diagnosis.</small>
        </div>
      </div>
    </PhoneFrame>
  );
}
