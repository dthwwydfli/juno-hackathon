import { Link } from 'react-router-dom';
import { PhoneFrame, StatusBar } from '../../components/Frame';

export function NotFound() {
  return (
    <PhoneFrame label="Not found">
      <StatusBar />
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Page not found</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 20px' }}>
          This link may be outdated or mistyped.
        </p>
        <Link to="/home" style={{ fontWeight: 600, color: 'var(--accent-ink)' }}>
          Open app
        </Link>
      </div>
    </PhoneFrame>
  );
}
