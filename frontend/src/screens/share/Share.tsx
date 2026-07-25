import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PhoneFrame, StatusBar, SubHeader } from '../../components/Frame';
import { Icon, iconForRoute } from '../../components/Icon';
import { useStore } from '../../data/store';
import { refreshInteractions, checkInteractions } from '../../lib/interactions';
import { qrDataUrl } from '../../lib/qr';
import { downloadPdfFromUrl, pdfObjectUrl, pdfPreviewObjectUrl, shareOrDownloadPdf, sharePdfLink, buildShareSnapshot } from '../../lib/pdf';
import { checkApiHealth, formatApiReachabilityError } from '../../lib/api';
import {
  cabinetSyncKey,
  gpPdfUrlForToken,
  prepareGpShare,
} from '../../lib/sync-cabinet';
import type { Category } from '../../data/types';
import './share.css';

type View = 'qr' | 'doc' | 'pdf';

const catClass: Record<Category, string> = { NHS: 'nhs', Private: 'priv', OTC: 'otc' };

function formatExpiryLabel(iso: string): string {
  const end = new Date(iso).getTime();
  const mins = Math.max(1, Math.round((end - Date.now()) / 60_000));
  if (mins < 120) return `Link expires in about ${mins} minutes for your privacy`;
  const hours = Math.round(mins / 60);
  return `Link expires in about ${hours} hours for your privacy`;
}

export function Share() {
  const nav = useNavigate();
  const { state } = useStore();
  const [params] = useSearchParams();
  const initial = (params.get('v') as View) || 'doc';
  const [view, setView] = useState<View>(['qr', 'doc', 'pdf'].includes(initial) ? initial : 'doc');

  const active = useMemo(() => state.medications.filter((m) => m.status === 'active'), [state.medications]);
  const archived = useMemo(() => state.medications.filter((m) => m.status === 'archived'), [state.medications]);
  const syncKey = useMemo(() => cabinetSyncKey(state.medications), [state.medications]);

  const [qrUrl, setQrUrl] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>('');
  const [shareErr, setShareErr] = useState<string>('');
  const [gpLinkErr, setGpLinkErr] = useState<string>('');
  const [shareLoading, setShareLoading] = useState(false);
  const [expiryLabel, setExpiryLabel] = useState<string>('');
  const [linkFeedback, setLinkFeedback] = useState<string>('');
  const [ixTick, setIxTick] = useState(0);

  const interactions = useMemo(() => checkInteractions(state.medications), [state.medications, ixTick]);

  useEffect(() => {
    if (view === 'qr' || view === 'pdf') return;
    void refreshInteractions(state.medications)
      .then(() => setIxTick((t) => t + 1))
      .catch(() => setIxTick((t) => t + 1));
  }, [state.medications, view]);

  useEffect(() => {
    if (view !== 'pdf') return;
    const localUrl = pdfObjectUrl(state);
    setPdfPreviewUrl(localUrl);
    return () => {
      setPdfPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
    };
  }, [view, syncKey, ixTick, state.profile.name, state.lastSynced, state]);

  useEffect(() => {
    if (view !== 'qr') return;
    let live = true;
    setShareErr('');
    setShareLoading(true);
    setQrUrl('');
    setPdfUrl('');
    setLinkFeedback('');
    (async () => {
      try {
        await checkApiHealth();
        const ix = checkInteractions(state.medications);
        const snapshot = buildShareSnapshot(state, ix);
        const tokenRes = await prepareGpShare(
          state.medications,
          state.profile.name,
          snapshot,
        );
        const url = gpPdfUrlForToken(tokenRes.token);
        if (!live) return;
        setPdfUrl(url);
        setExpiryLabel(formatExpiryLabel(tokenRes.expires_at));
        const qr = await qrDataUrl(url, { size: 320 });
        if (live) setQrUrl(qr);
      } catch (e) {
        if (live) setShareErr(formatApiReachabilityError(e));
      } finally {
        if (live) setShareLoading(false);
      }
    })();
    return () => { live = false; };
  }, [view, syncKey, state.profile.name]);

  useEffect(() => {
    if (view !== 'pdf') return;
    let live = true;
    setGpLinkErr('');
    setShareLoading(true);
    setPdfUrl('');
    (async () => {
      try {
        await checkApiHealth();
        const ix = checkInteractions(state.medications);
        const snapshot = buildShareSnapshot(state, ix);
        const tokenRes = await prepareGpShare(
          state.medications,
          state.profile.name,
          snapshot,
        );
        const url = gpPdfUrlForToken(tokenRes.token);
        if (!live) return;
        setPdfUrl(url);
        setExpiryLabel(formatExpiryLabel(tokenRes.expires_at));
        try {
          const backendBlob = await pdfPreviewObjectUrl(url);
          if (live) {
            setPdfPreviewUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return backendBlob;
            });
          }
        } catch {
          if (live) {
            setGpLinkErr('Could not refresh preview from server. Showing local copy.');
          }
        }
      } catch (e) {
        if (live) setGpLinkErr(formatApiReachabilityError(e));
      } finally {
        if (live) setShareLoading(false);
      }
    })();
    return () => { live = false; };
  }, [view, syncKey, state.profile.name]);

  const archNames = archived.slice(0, 3).map((m) => m.name).join(', ');
  const archExtra = archived.length - Math.min(3, archived.length);

  const savePdf = async () => {
    try {
      if (pdfUrl) {
        await downloadPdfFromUrl(pdfUrl);
        return;
      }
      await shareOrDownloadPdf(state);
    } catch {
      await shareOrDownloadPdf(state);
    }
  };

  const shareLink = async () => {
    if (pdfUrl) {
      const mode = await sharePdfLink(pdfUrl);
      setLinkFeedback(mode === 'shared' ? 'Link shared' : 'Link copied to clipboard');
      return;
    }
    await savePdf();
  };

  const qrPlaceholder = shareLoading ? 'Generating QR…' : shareErr || '';

  if (view === 'pdf') {
    return (
      <PhoneFrame label="Medication summary PDF">
        <div className="shr-pdf">
          <StatusBar />
          <div className="shr-pdf-top">
            <button className="done" onClick={() => setView('doc')}>Done</button>
            <span className="fname">Medication-summary.pdf</span>
            <button className="shr-glyph" aria-label="Share PDF" onClick={() => void savePdf()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11" /><path d="M8.5 6.5L12 3l3.5 3.5" /><path d="M6 11v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8" /></svg>
            </button>
          </div>
          {gpLinkErr && (
            <div className="shr-pdf-notice" role="status">{gpLinkErr}</div>
          )}
          <div className="shr-pdf-frame-wrap">
            {pdfPreviewUrl ? (
              <iframe src={`${pdfPreviewUrl}#toolbar=0&navpanes=0&view=FitH`} title="Medication summary PDF" />
            ) : (
              <div className="shr-qr-ph">Loading PDF…</div>
            )}
          </div>
          <div className="shr-pdf-bottom">
            <span className="shr-pdf-page-ind">Page 1 of 1</span>
            <button className="shr-pdf-share" onClick={() => void shareLink()} disabled={shareLoading}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v11" /><path d="M8.5 6.5L12 3l3.5 3.5" /><path d="M6 11v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8" /></svg>
              Share
            </button>
            <button className="shr-pdf-print" aria-label="Print" onClick={() => window.print()}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6" /><rect x="4" y="9" width="16" height="8" rx="2" /><path d="M7 17h10v4H7z" /></svg>
            </button>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame label="Share with your GP">
      <StatusBar />
      <SubHeader title="Share with your GP" onBack={() => nav('/home')} />

      {view === 'qr' ? (
        <div className="shr-root shr-qr">
          <div className="shr-qr-body">
            <div className="shr-qrcard">
              {qrUrl ? (
                <img src={qrUrl} alt="QR code for your medication summary" />
              ) : (
                <div className="shr-qr-ph">{qrPlaceholder}</div>
              )}
            </div>
            <div className="shr-qtitle">Show this to your GP</div>
            <div className="shr-qsub">They scan it to open your medication summary — no app or login needed.</div>
            <div className="shr-qchips">
              <span className="shr-qchip"><b>{active.length}</b> meds</span>
              <span className="shr-qchip"><b>{interactions.length}</b> interactions</span>
              <span className="shr-qchip"><b>{archived.length}</b> archived</span>
            </div>
            <div className="shr-expiry">
              <Icon name="clock" size={14} />
              {expiryLabel || 'Creating a time-limited link…'}
            </div>
            {linkFeedback && <div className="shr-expiry">{linkFeedback}</div>}
            {pdfUrl && (
              <div className="shr-expiry shr-qr-link">
                Opens: {pdfUrl.replace(/^https?:\/\//, '')}
              </div>
            )}
          </div>
          <div className="shr-qr-foot">
            <button className="shr-btn ghost" onClick={() => void savePdf()} disabled={shareLoading}>
              <Icon name="download" size={17} /> Save PDF
            </button>
            <button className="shr-btn primary" onClick={() => void shareLink()} disabled={shareLoading}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4M12 2v13" /></svg>
              Share link
            </button>
          </div>
        </div>
      ) : (
        <div className="shr-root shr-doc">
          <button className="shr-docbar" onClick={() => setView('pdf')}>
            <span className="di"><Icon name="external" size={20} /></span>
            <span>
              <span className="d1" style={{ display: 'block' }}>Medication summary</span>
              <span className="d2" style={{ display: 'block' }}>Tap to open as PDF · read-only</span>
            </span>
            <Icon name="chevron" size={20} className="dchev" />
          </button>

          <div className="shr-patient">
            <div>
              <div className="pn">{state.profile.name}</div>
              <div className="pm">{state.profile.age} · {state.profile.gender} · NHS no. {state.profile.nhsNumber}</div>
            </div>
            <div className="gen">Generated<br />{state.lastSynced}</div>
          </div>

          <div className="shr-doc-body">
            <div className="shr-sec">
              <div className="sh"><span>Current medications</span><span className="tab">{active.length} active</span></div>
              {active.map((m) => (
                <div className="shr-med" key={m.id}>
                  <span className="mi"><Icon name={iconForRoute(m.route)} size={17} /></span>
                  <div>
                    <div className="mn">{m.name} {m.dose}</div>
                    <div className="md">{m.brand} · {m.scheduleLabel || m.times.join(', ')}</div>
                  </div>
                  <span className={`cat ${catClass[m.category]}`}>{m.category}</span>
                </div>
              ))}
            </div>

            <div className="shr-sec">
              <div className="sh"><span>Potential interactions</span><span className="tab">{interactions.length} flagged</span></div>
              {interactions.map((i) => (
                <div className="shr-ix" key={i.id}>
                  <Icon name="warning" size={16} strokeWidth={2} />
                  <span><b>{i.a} ⇄ {i.b}</b> — {i.reason}</span>
                </div>
              ))}
            </div>

            <div className="shr-sec">
              <div className="sh"><span>Archived</span><span className="tab">{archived.length} items</span></div>
              <div className="shr-arch">
                <Icon name="archive" size={16} />
                <span><b>{archived.length} past medications</b> · {archNames}{archExtra > 0 ? ` +${archExtra}` : ''}</span>
              </div>
            </div>

            <div className="shr-attrib">
              <Icon name="info" size={13} />
              Information only — not medical advice. Source: NHS · BNF.
            </div>
          </div>

          <div className="shr-doc-foot">
            <button className="shr-dfbtn ghost" onClick={() => setView('qr')}>
              <Icon name="qr" size={17} /> Show QR code
            </button>
            <button className="shr-dfbtn primary" onClick={() => setView('pdf')}>
              <Icon name="external" size={17} /> Open PDF
            </button>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}
