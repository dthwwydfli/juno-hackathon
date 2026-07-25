import type { Interaction, Medication } from '../data/types';
import { apiFetch, checkApiHealth } from './api';
import { syncCabinetToBackend } from './sync-cabinet';

export interface LiveCheckOptions {
  onProgress?: (found: Interaction[]) => void;
}

export interface LiveCheckResult {
  interactions: Interaction[];
}

export type LiveRefreshState = 'idle' | 'loading' | 'ready' | 'error';

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'med';
}

function pairId(nameA: string, nameB: string): string {
  const parts = [slug(nameA), slug(nameB)].sort();
  return `${parts[0]}-${parts[1]}`;
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

function medByName(meds: Medication[], name: string): Medication | undefined {
  const n = norm(name);
  return meds.find((m) => norm(m.name) === n || norm(m.dmdDisplayName || '') === n);
}

function firstToken(displayName: string): string {
  return displayName.split(/\s+/)[0] || displayName;
}

function guessAffects(text: string): { label: string }[] {
  const lower = text.toLowerCase();
  const labels: string[] = [];
  if (/blood pressure|hypertension|bp\b/.test(lower)) labels.push('Blood pressure');
  if (/kidney|renal/.test(lower)) labels.push('Kidney function');
  if (/bleed|anticoagul|clot/.test(lower)) labels.push('Bleeding risk');
  if (/stomach|gi\b|ulcer|nausea/.test(lower)) labels.push('Stomach');
  if (/serotonin/.test(lower)) labels.push('Serotonin levels');
  if (!labels.length) labels.push('Medicine effectiveness');
  return labels.map((label) => ({ label }));
}

function buildInteraction(
  medA: Medication,
  medB: Medication,
  reason: string,
  detail: string,
  source: string,
): Interaction {
  return {
    id: pairId(medA.name, medB.name),
    a: medA.name,
    b: medB.name,
    aCategory: medA.category,
    bCategory: medB.category,
    reason,
    detail,
    affects: guessAffects(`${reason} ${detail}`),
    goodToKnow: [
      'Discuss with a pharmacist or GP before changing medicines.',
      'Interaction data may not match your exact UK pack.',
    ],
    source,
  };
}

interface BackendWarning {
  interaction_id: number;
  summary: string;
  med_a: { display_name: string };
  med_b: { display_name: string };
}

async function mapWarningsToInteractions(
  meds: Medication[],
  warnings: BackendWarning[],
): Promise<Interaction[]> {
  const active = meds.filter((m) => m.status === 'active');
  const out: Interaction[] = [];
  for (const w of warnings) {
    const nameA = firstToken(w.med_a.display_name);
    const nameB = firstToken(w.med_b.display_name);
    const medA =
      medByName(active, nameA) ||
      active.find((m) => w.med_a.display_name.toLowerCase().includes(m.name.toLowerCase()));
    const medB =
      medByName(active, nameB) ||
      active.find((m) => w.med_b.display_name.toLowerCase().includes(m.name.toLowerCase()));
    if (!medA || !medB) continue;
    let detail = w.summary;
    let source = 'MedData';
    try {
      const d = await apiFetch<{ full_text?: string; summary?: string; sources?: { source?: string }[] }>(
        `/interactions/${w.interaction_id}`,
        { timeoutMs: 15_000 },
      );
      detail = d.full_text || d.summary || w.summary;
      const src = d.sources?.[0]?.source;
      if (src === 'meddata') source = 'MedData';
    } catch {
      /* use summary */
    }
    out.push(buildInteraction(medA, medB, w.summary, detail, source));
  }
  return out;
}

/** Run interaction check on the Python backend (MedData-only by default). */
export async function checkInteractionsLive(
  allMeds: Medication[],
  opts?: LiveCheckOptions,
): Promise<LiveCheckResult> {
  const active = allMeds.filter((m) => m.status === 'active');
  if (active.length < 2) {
    return { interactions: [] };
  }

  await checkApiHealth();
  await syncCabinetToBackend(allMeds.filter((m) => m.status === 'active' || m.status === 'archived'));

  const res = await apiFetch<{ warnings: BackendWarning[] }>('/interactions/check', {
    method: 'POST',
    body: JSON.stringify({ meddata_only: true }),
    timeoutMs: 90_000,
  });

  const list = await mapWarningsToInteractions(allMeds, res.warnings || []);
  opts?.onProgress?.(list);
  return { interactions: list };
}

export async function interactionsForLive(
  med: Medication,
  existing: Medication[],
): Promise<Interaction[]> {
  const active = existing.filter((m) => m.id !== med.id && m.status === 'active');
  if (!active.length) return [];
  const all = [...active, { ...med, status: 'active' as const }];
  const result = await checkInteractionsLive(all);
  const n = norm(med.name);
  return result.interactions.filter((i) => norm(i.a) === n || norm(i.b) === n);
}
