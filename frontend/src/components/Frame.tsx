import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import './components.css';

/**
 * The physical phone. Rendered ONCE by App.tsx, outside the router, so it stays
 * put while screens move inside it.
 *
 * Splitting this out of PhoneFrame is what makes stack transitions possible
 * without editing a single screen: two screens can be mounted at once inside
 * one shell, instead of each screen dragging its own frame along with it.
 */
export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="stage">
      <div className="phone">
        {children}
        <div className="home-ind" />
      </div>
    </div>
  );
}

/**
 * One screen's fill layer. Keeps its original name and signature so all 11
 * screens continue to work untouched — it just no longer owns the frame.
 */
export function PhoneFrame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="screen" role="group" aria-label={label ?? 'Pharmacy in Your Pocket'}>
      {children}
    </div>
  );
}

/** iOS-style status bar (9:41 + signal/battery), identical across the mockups. */
export function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`status${dark ? ' on-dark' : ''}`}>
      <span>9:41</span>
      <span className="signal">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1" /><rect x="5" y="4.5" width="3" height="7.5" rx="1" /><rect x="10" y="2" width="3" height="10" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" opacity=".35" /></svg>
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none"><rect x="1" y="1" width="19" height="10" rx="3" stroke="currentColor" strokeWidth="1.2" opacity=".5" /><rect x="2.5" y="2.5" width="14" height="7" rx="1.6" fill="currentColor" /><rect x="21" y="4" width="2" height="4" rx="1" fill="currentColor" opacity=".5" /></svg>
      </span>
    </div>
  );
}

/** Home / Interactions header: title + subtitle + persistent home, profile & QR buttons. */
export function AppHeader({ title, subtitle, showHome = true, condensed = false }: { title: string; subtitle?: string; showHome?: boolean; condensed?: boolean }) {
  const nav = useNavigate();
  return (
    <div className={`header${condensed ? ' condensed' : ''}`}>
      <div>
        <h1>{title}</h1>
        {subtitle && <span className="sub">{subtitle}</span>}
      </div>
      <div className="hbtns">
        {showHome && (
          <button className="icon-btn" aria-label="Home" onClick={() => nav('/home')}>
            <Icon name="home" size={19} />
          </button>
        )}
        <button className="icon-btn" aria-label="Your profile and settings" onClick={() => nav('/settings')}>
          <Icon name="profile" size={20} />
        </button>
      </div>
    </div>
  );
}

/** A round Home button for the top bar of pushed sub-screens. */
export function HomeButton() {
  const nav = useNavigate();
  return (
    <button className="icon-btn" aria-label="Home" onClick={() => nav('/home')}>
      <Icon name="home" size={19} />
    </button>
  );
}

/** Pushed sub-screen header: back button + centered title + (default) Home button. */
export function SubHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="subhead">
      <button className="icon-btn" aria-label="Back" onClick={onBack ?? (() => nav(-1))}>
        <Icon name="back" size={20} />
      </button>
      <span className="title">{title}</span>
      {right ?? <HomeButton />}
    </div>
  );
}

type NavKey = 'interactions' | 'share' | null;

/** Bottom navigation: Interactions | ＋Add | Share. */
export function BottomNav({ active, interactionsAlert }: { active?: NavKey; interactionsAlert?: boolean }) {
  const nav = useNavigate();
  return (
    <div className="nav">
      <button className={`nav-item${active === 'interactions' ? ' active' : ''}${interactionsAlert ? ' nav-alert' : ''}`} onClick={() => nav('/interactions')}>
        <Icon name="warning" />
        Interactions
      </button>
      <div className="nav-add">
        <button className="fab" aria-label="Add medication" onClick={() => nav('/add')}>
          <Icon name="plus" size={26} strokeWidth={2} />
        </button>
        <span>Add</span>
      </div>
      <button className={`nav-item${active === 'share' ? ' active' : ''}`} onClick={() => nav('/share')}>
        <Icon name="share" />
        Share
      </button>
    </div>
  );
}

/** Not-medical-advice line used on interaction / GP surfaces. */
export function GpNote({ children }: { children?: ReactNode }) {
  return (
    <div className="gp-note">
      <Icon name="info" size={16} />
      <span>{children ?? 'Information only. Not medical advice. Please discuss with your GP.'}</span>
    </div>
  );
}

/** Modal + bottom sheet primitives. */
export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  useEscClose(onClose);
  return (
    <div className="scrim center" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Sheet({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  useEscClose(onClose);
  return (
    <div className="scrim bottom" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        {children}
      </div>
    </div>
  );
}

function useEscClose(onClose?: () => void) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}
