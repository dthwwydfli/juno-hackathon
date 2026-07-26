import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { PhoneFrame, StatusBar } from '../../components/Frame';
import { Icon } from '../../components/Icon';
import { ApiError, fetchApiUrl, formatApiReachabilityError, localtunnel511Message } from '../../lib/api';
import { gpPdfUrlForToken } from '../../lib/sync-cabinet';
import { APP_NAME } from '../../lib/brand';
import './gp-share.css';

function gpPdfFetchUrl(token: string): string {
  return gpPdfUrlForToken(token);
}

function useGpToken(): string | undefined {
  const { token: pathToken } = useParams<{ token?: string }>();
  const [params] = useSearchParams();
  const q = params.get('gp')?.trim();
  if (pathToken) {
    try {
      return decodeURIComponent(pathToken);
    } catch {
      return pathToken;
    }
  }
  if (q) return q;
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('gp')?.trim() ?? undefined;
  }
  return undefined;
}

export function GpShareView() {
  const token = useGpToken();
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Missing share link.');
      setLoading(false);
      return;
    }

    let live = true;
    let objectUrl = '';

    (async () => {
      setLoading(true);
      setError('');
      setPreviewUrl('');
      try {
        const pdfUrl = gpPdfFetchUrl(token);
        const res = await fetchApiUrl(pdfUrl);
        if (res.status === 511) {
          throw new ApiError(localtunnel511Message(), 511);
        }
        if (res.status === 410) {
          throw new ApiError('This share link has expired.', 410);
        }
        if (res.status === 404) {
          throw new ApiError('This link is invalid or has expired.', 404);
        }
        if (!res.ok) {
          if (res.status >= 500) {
            throw new ApiError(
              'Server error loading summary. Check that the backend is running and review its logs.',
              res.status,
            );
          }
          throw new ApiError('Could not load medication summary.', res.status);
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (live) setPreviewUrl(objectUrl);
      } catch (e) {
        if (live) setError(formatApiReachabilityError(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token]);

  return (
    <PhoneFrame label="GP medication summary">
      <StatusBar />
      <header className="gp-share-head">
        <div className="gp-share-brand">{APP_NAME}</div>
        <h1 className="gp-share-title">Medication summary</h1>
        <p className="gp-share-sub">Shared by the patient · read-only · for clinical review</p>
      </header>

      <div className="gp-share-body">
        {loading && (
          <div className="gp-share-status">
            <Icon name="clock" size={18} />
            Loading summary…
          </div>
        )}
        {!loading && error && (
          <div className="gp-share-error" role="alert">
            {error}
          </div>
        )}
        {!loading && previewUrl && (
          <div className="gp-share-pdf">
            <a className="gp-share-open" href={previewUrl} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={16} />
              Open PDF
            </a>
            <iframe
              className="gp-share-iframe"
              title="Medication summary"
              src={previewUrl}
            />
          </div>
        )}
      </div>

      <footer className="gp-share-foot">
        <Icon name="info" size={14} />
        Information only. Not medical advice. Discuss with the patient before changing treatment.
      </footer>
    </PhoneFrame>
  );
}
