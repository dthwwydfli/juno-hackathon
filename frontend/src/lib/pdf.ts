import { jsPDF } from 'jspdf';
import type { AppState, Interaction } from '../data/types';
import { checkInteractions } from './interactions';

export interface ShareSnapshot {
  profile: {
    name: string;
    age: number;
    gender: string;
    nhsNumber: string;
  };
  lastSynced: string;
  medications: Array<{
    name: string;
    dose: string;
    brand: string;
    category: string;
    scheduleLabel?: string;
    times: string[];
    route: string;
    status: 'active' | 'archived';
  }>;
  interactions: Array<{ a: string; b: string; reason: string }>;
}

/** Payload frozen at share time; backend PDF uses this as source of truth. */
export function buildShareSnapshot(state: AppState, interactions: Interaction[]): ShareSnapshot {
  return {
    profile: {
      name: state.profile.name,
      age: state.profile.age,
      gender: state.profile.gender,
      nhsNumber: state.profile.nhsNumber,
    },
    lastSynced: state.lastSynced,
    medications: state.medications.map((m) => ({
      name: m.name,
      dose: m.dose,
      brand: m.brand,
      category: m.category,
      scheduleLabel: m.scheduleLabel,
      times: m.times ?? [],
      route: m.route,
      status: m.status,
    })),
    interactions: interactions.map((i) => ({ a: i.a, b: i.b, reason: i.reason })),
  };
}

const TEAL: [number, number, number] = [18, 165, 148];
const AMBER: [number, number, number] = [199, 121, 31];
const INK: [number, number, number] = [26, 26, 23];
const MUTED: [number, number, number] = [107, 107, 99];

/** Build a real A4 medication-summary PDF from the live state. */
export function buildSummaryPdf(state: AppState, interactions?: Interaction[]): jsPDF {
  const ix = interactions ?? checkInteractions(state.medications);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEAL);
  doc.setFontSize(10);
  doc.text('PHARMACY IN YOUR POCKET', M, y);
  doc.setTextColor(...MUTED);
  doc.text('MEDICATION SUMMARY', W - M, y, { align: 'right' });

  y += 26;
  doc.setDrawColor(236, 235, 230);
  doc.line(M, y, W - M, y);

  y += 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text(state.profile.name, M, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`${state.profile.age} · ${state.profile.gender} · NHS ${state.profile.nhsNumber}`, M, y);
  y += 14;
  doc.text(`Generated ${state.lastSynced}`, M, y);

  const active = state.medications.filter((m) => m.status === 'active');
  y += 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(`CURRENT MEDICATIONS  (${active.length})`, M, y);
  y += 8;
  doc.setDrawColor(236, 235, 230);
  doc.line(M, y, W - M, y);
  y += 20;

  for (const m of active) {
    if (y > 760) { doc.addPage(); y = 56; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(`${m.name} ${m.dose}`, M, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(m.category, W - M, y, { align: 'right' });
    y += 14;
    doc.setFontSize(9.5);
    doc.text(`${m.brand} · ${m.scheduleLabel || m.times.join(', ')} · ${m.route}`, M, y);
    y += 22;
  }

  const interactionsList = ix;
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(`POTENTIAL INTERACTIONS  (${interactionsList.length})`, M, y);
  y += 8;
  doc.line(M, y, W - M, y);
  y += 20;

  for (const i of interactionsList) {
    if (y > 740) { doc.addPage(); y = 56; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...AMBER);
    doc.text(`${i.a}  +  ${i.b}`, M, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(i.reason, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 12 + 12;
  }

  const archived = state.medications.filter((m) => m.status === 'archived');
  if (archived.length) {
    if (y > 700) { doc.addPage(); y = 56; }
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(`ARCHIVED  (${archived.length})`, M, y);
    y += 8;
    doc.line(M, y, W - M, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    const names = archived.map((m) => `${m.name} ${m.dose}`).join(',  ');
    const lines = doc.splitTextToSize(names, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 12 + 8;
  }

  if (y > 720) { doc.addPage(); y = 56; }
  y += 6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const note = doc.splitTextToSize(
    'Information only — not medical advice or a diagnosis. Please discuss with your GP or pharmacist. Interaction data sourced from NHS · BNF via a healthcare API.',
    W - M * 2,
  );
  doc.text(note, M, y);

  return doc;
}

/** Download a PDF from a URL (e.g. backend GP summary). */
export async function downloadPdfFromUrl(
  url: string,
  filename = 'medication-summary.pdf',
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download PDF');
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
}

/** Fetch PDF bytes and return a blob URL suitable for iframe preview on iOS. */
export async function pdfPreviewObjectUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load PDF preview');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Native share or clipboard copy for a GP summary link. */
export async function sharePdfLink(url: string): Promise<'shared' | 'copied'> {
  const navAny = navigator as Navigator & {
    share?: (data: { url?: string; title?: string }) => Promise<void>;
  };
  if (navAny.share) {
    try {
      await navAny.share({ url, title: 'Medication summary' });
      return 'shared';
    } catch {
      /* fall through */
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

/** Generate the PDF and share it (Web Share API with files) or fall back to download. */
export async function shareOrDownloadPdf(state: AppState): Promise<'shared' | 'downloaded'> {
  const doc = buildSummaryPdf(state);
  const blob = doc.output('blob');
  const filename = 'medication-summary.pdf';
  const file = new File([blob], filename, { type: 'application/pdf' });

  const navAny = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (navAny.share && navAny.canShare && navAny.canShare({ files: [file] })) {
    try {
      await navAny.share({ files: [file], title: 'Medication summary', text: 'My medication summary' });
      return 'shared';
    } catch {
      // user cancelled or share failed — fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

/** A blob URL for previewing the PDF inline (e.g. in an <iframe> Quick-Look mock). */
export function pdfObjectUrl(state: AppState): string {
  const doc = buildSummaryPdf(state);
  return URL.createObjectURL(doc.output('blob'));
}
