import { useState } from 'react';
import { PhoneFrame, StatusBar, SubHeader } from '../../components/Frame';
import { Icon } from '../../components/Icon';
import { useStore } from '../../data/store';
import type { SyncEntry } from '../../data/types';
import './nhs-connection.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format a Date as "25 Jul 2026, 09:41" to match the sync log style. */
function formatStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NhsConnection() {
  const { state, syncNow } = useStore();
  const [syncing, setSyncing] = useState(false);
  const { profile, syncLog } = state;

  const handleSync = () => {
    if (syncing) return;
    setSyncing(true);
    // brief "Syncing…" moment, then prepend a new version entry
    setTimeout(() => {
      const nextVersion = syncLog.reduce((max, e) => Math.max(max, e.version), 0) + 1;
      const stamp = formatStamp(new Date());
      const entry: SyncEntry = {
        version: nextVersion,
        summary: 'No changes',
        mode: 'Manual',
        datetime: stamp,
      };
      syncNow(entry, stamp);
      setSyncing(false);
    }, 900);
  };

  return (
    <PhoneFrame label="NHS connection">
      <StatusBar />
      <SubHeader title="NHS connection" />
      <div className="screen-body">
        <div className="nhs-screen">

          {/* status hero */}
          <div className="hero">
            <span className="badge">NHS</span>
            <div>
              <div className="h1">Connected to your NHS record</div>
              <div className="h2">NHS no. {profile.nhsNumber}</div>
            </div>
            <span className="conn"><span className="d" /> Linked</span>
          </div>

          {/* sync card */}
          <div className="sync">
            <div className="top">
              <span className="si"><Icon name="sync" size={22} strokeWidth={1.9} /></span>
              <div>
                <div className="s1">Last synced</div>
                <div className="s2">{state.lastSynced}</div>
              </div>
              <span className="uptodate">
                <Icon name="check" size={15} strokeWidth={2.2} /> Up to date
              </span>
            </div>
            <button className="syncbtn" type="button" onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <><span className="spin"><Icon name="sync" size={18} strokeWidth={2} /></span> Syncing…</>
              ) : (
                <><Icon name="sync" size={18} strokeWidth={2} /> Sync now</>
              )}
            </button>
            <div className="synchint">
              <Icon name="info" size={14} strokeWidth={2} />
              Just been to your GP? Records sync automatically each morning. Tap Sync now to pull the latest straight away.
            </div>
          </div>

          {/* sync history */}
          <div className="glabel">Sync history</div>
          <div className="log">
            {syncLog.map((e, i) => (
              <div className={`lrow${i === 0 ? ' now' : ''}`} key={`${e.version}-${e.datetime}`}>
                <span className="ldot"><span className="c" /></span>
                <div className="lmain">
                  <div className="l1">{e.summary}</div>
                  <div className="l2">{e.mode === 'Manual' ? 'Manual refresh' : 'Automatic sync'} · {e.datetime}</div>
                </div>
                <span className="lv">v{e.version}</span>
              </div>
            ))}
          </div>

          <button className="disconnect" type="button">Disconnect NHS account</button>

        </div>
      </div>
    </PhoneFrame>
  );
}
