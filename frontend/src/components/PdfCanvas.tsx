import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import './pdf-canvas.css';

// Bundled locally via Vite so the worker is never fetched from a CDN.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface Props {
  /** Blob or http URL of the PDF to render. */
  url: string;
  /** Reports total pages and the page currently in view. */
  onPages?: (total: number, current: number) => void;
}

/**
 * Renders a PDF to canvases sized to the container width.
 *
 * The browser's built-in PDF plugin letterboxes an A4 page inside the 390px
 * phone frame and paints its own dark surround, so the preview showed black
 * bars. Drawing the pages ourselves means the paper always fills the width.
 */
export function PdfCanvas({ url, onPages }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !url) return;

    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    let task: ReturnType<typeof pdfjs.getDocument> | null = null;
    let observer: IntersectionObserver | null = null;

    (async () => {
      try {
        task = pdfjs.getDocument({ url });
        doc = await task.promise;
        if (cancelled) return;

        const width = wrap.clientWidth;
        // Cap the backing store so a retina render of several pages stays cheap.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        wrap.replaceChildren();

        const canvases: HTMLCanvasElement[] = [];
        for (let n = 1; n <= doc.numPages; n += 1) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: width / base.width });

          const canvas = document.createElement('canvas');
          canvas.className = 'pdfc-page';
          canvas.dataset.page = String(n);
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          wrap.appendChild(canvas);
          canvases.push(canvas);

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          ctx.scale(dpr, dpr);
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        }

        if (cancelled) return;
        onPages?.(doc.numPages, 1);

        if (canvases.length > 1) {
          observer = new IntersectionObserver(
            (entries) => {
              const visible = entries
                .filter((e) => e.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
              if (visible) {
                const page = Number((visible.target as HTMLElement).dataset.page);
                onPages?.(doc?.numPages ?? 1, page);
              }
            },
            { root: wrap.parentElement, threshold: [0.25, 0.5, 0.75] },
          );
          canvases.forEach((c) => observer?.observe(c));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not render PDF');
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      void task?.destroy();
    };
  }, [url, onPages]);

  return (
    <div className="pdfc-scroll">
      {error && <div className="pdfc-error">{error}</div>}
      {/* Canvases are appended imperatively, so React must not own this node. */}
      <div className="pdfc-pages" ref={wrapRef} />
    </div>
  );
}

// Default export so Share.tsx can React.lazy() this module: pdfjs plus its 2.2 MB
// worker is only reachable from the Share screen's PDF tab.
export default PdfCanvas;
