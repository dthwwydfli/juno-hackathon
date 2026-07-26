import { Link } from 'react-router-dom';
import { PhoneFrame, StatusBar, SubHeader } from '../components/Frame';

/** Placeholder used until a Phase-1 agent replaces the screen. Keeps the app navigable. */
export function Stub({ name, links }: { name: string; links?: { to: string; label: string }[] }) {
  return (
    <PhoneFrame label={name}>
      <StatusBar />
      <SubHeader title={name} />
      <div className="screen-body" style={{ padding: 24, gap: 12 }}>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>“{name}” screen: coming from a Phase 1 build agent.</p>
        {(links ?? [{ to: '/home', label: 'Go to Home' }]).map((l) => (
          <Link key={l.to} to={l.to} className="btn" style={{ textDecoration: 'none' }}>{l.label}</Link>
        ))}
      </div>
    </PhoneFrame>
  );
}
