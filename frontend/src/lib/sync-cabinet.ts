import type { Medication } from '../data/types';
import { apiFetch, formatApiReachabilityError, pdfOrigin } from './api';
import type { ShareSnapshot } from './pdf';

type BackendCategory = 'nhs_prescription' | 'otc' | 'online';

interface BackendMed {
  id: number;
  display_name: string;
  category: BackendCategory;
  dosage: string;
  schedule?: { times?: string[]; scheduleLabel?: string };
  gtin?: string | null;
  archived_at?: string | null;
}

const SYNC_TIMEOUT_MS = 120_000;
const TOKEN_TIMEOUT_MS = 30_000;
const SYNC_DEDUPE_MS = 30_000;

let lastCabinetSyncAt = 0;
let lastCabinetSyncKey = '';

function markCabinetSynced(medications: Medication[]): void {
  lastCabinetSyncAt = Date.now();
  lastCabinetSyncKey = cabinetSyncKey(medications);
}

function toBackendCategory(c: Medication['category']): BackendCategory {
  if (c === 'NHS') return 'nhs_prescription';
  if (c === 'Private') return 'online';
  return 'otc';
}

function toDisplayName(m: Medication): string {
  if (m.dmdDisplayName?.trim()) return m.dmdDisplayName.trim();
  const dose = m.dose?.trim();
  return dose ? `${m.name.trim()} ${dose}`.trim() : m.name.trim();
}

/**
 * Must produce the same key as the remote side (`gtin || display_name`).
 * It previously used `name|dose`, which never matched a remote row for meds
 * without a GTIN, so every sync created a fresh duplicate.
 */
function cabinetKey(m: Medication): string {
  return (m.gtin || toDisplayName(m)).toLowerCase();
}

function toDosage(m: Medication): string {
  if (m.dose?.trim()) return m.dose.trim();
  return m.regimen?.[0]?.dose?.trim() || 'As directed';
}

export async function syncCabinetToBackend(
  medications: Medication[],
  opts?: { force?: boolean },
): Promise<void> {
  const key = cabinetSyncKey(medications);
  const now = Date.now();
  if (
    !opts?.force &&
    key === lastCabinetSyncKey &&
    now - lastCabinetSyncAt < SYNC_DEDUPE_MS
  ) {
    return;
  }
  const remote = await apiFetch<BackendMed[]>('/medications?status=all', { timeoutMs: SYNC_TIMEOUT_MS });
  const remoteActive = new Map<string, BackendMed>();
  const remoteArchived = new Map<string, BackendMed>();
  for (const r of remote) {
    const key = (r.gtin || r.display_name).toLowerCase();
    if (r.archived_at) remoteArchived.set(key, r);
    else remoteActive.set(key, r);
  }

  const desiredActive = medications.filter((m) => m.status === 'active');
  const desiredArchived = medications.filter((m) => m.status === 'archived');
  const desiredActiveKeys = new Set(desiredActive.map(cabinetKey));
  const desiredArchivedKeys = new Set(desiredArchived.map(cabinetKey));

  for (const m of desiredActive) {
    const key = cabinetKey(m);
    const existing = remoteActive.get(key) || remoteArchived.get(key);
    const schedule = {
      times: m.times,
      scheduleLabel: m.scheduleLabel,
      regimen: m.regimen,
    };
    if (!existing) {
      await apiFetch('/medications', {
        method: 'POST',
        body: JSON.stringify({
          display_name: toDisplayName(m),
          category: toBackendCategory(m.category),
          dosage: toDosage(m),
          schedule,
          gtin: m.gtin || null,
        }),
        timeoutMs: SYNC_TIMEOUT_MS,
      });
    } else if (existing.archived_at) {
      await apiFetch(`/medications/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archive: false, dosage: toDosage(m), schedule }),
        timeoutMs: SYNC_TIMEOUT_MS,
      });
    }
  }

  for (const m of desiredArchived) {
    const key = cabinetKey(m);
    const existing = remoteActive.get(key) || remoteArchived.get(key);
    if (existing && !existing.archived_at) {
      await apiFetch(`/medications/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archive: true }),
        timeoutMs: SYNC_TIMEOUT_MS,
      });
    } else if (!existing) {
      await apiFetch('/medications', {
        method: 'POST',
        body: JSON.stringify({
          display_name: toDisplayName(m),
          category: toBackendCategory(m.category),
          dosage: toDosage(m),
          schedule: { times: m.times, scheduleLabel: m.scheduleLabel },
          gtin: m.gtin || null,
        }),
        timeoutMs: SYNC_TIMEOUT_MS,
      });
      const again = await apiFetch<BackendMed[]>('/medications?status=active', { timeoutMs: SYNC_TIMEOUT_MS });
      const row = again.find((r) => (r.gtin || r.display_name).toLowerCase() === key);
      if (row) {
        await apiFetch(`/medications/${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ archive: true }),
          timeoutMs: SYNC_TIMEOUT_MS,
        });
      }
    }
  }

  for (const [key, r] of remoteActive) {
    if (!desiredActiveKeys.has(key) && !desiredArchivedKeys.has(key)) {
      await apiFetch(`/medications/${r.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archive: true }),
        timeoutMs: SYNC_TIMEOUT_MS,
      });
    }
  }
  markCabinetSynced(medications);
}

export interface ShareTokenResponse {
  token: string;
  expires_at: string;
  pdf_url: string;
}

export async function createGpShareToken(
  patientLabel?: string,
  snapshot?: ShareSnapshot,
): Promise<ShareTokenResponse> {
  return apiFetch<ShareTokenResponse>('/gp/share-token', {
    method: 'POST',
    body: JSON.stringify({
      patient_label: patientLabel || null,
      snapshot: snapshot ?? null,
    }),
    timeoutMs: TOKEN_TIMEOUT_MS,
  });
}

export function gpPdfUrlForToken(token: string): string {
  return `${pdfOrigin()}/gp/summary/${token}.pdf`;
}

/** Stable key so share flow does not re-sync on unrelated store updates. */
export function cabinetSyncKey(medications: Medication[]): string {
  return medications
    .map((m) =>
      [
        m.id,
        m.status,
        m.name,
        m.dose,
        m.gtin || '',
        m.scheduleLabel || '',
        (m.times || []).join(','),
      ].join('|'),
    )
    .sort()
    .join('\n');
}

function backendCategoryToFrontend(c: BackendCategory): Medication['category'] {
  if (c === 'nhs_prescription') return 'NHS';
  if (c === 'online') return 'Private';
  return 'OTC';
}

function backendRowToMedication(r: BackendMed): Medication {
  const display = r.display_name.trim();
  const tokens = display.split(/\s+/);
  const name = tokens[0] || display;
  const doseFromName = tokens.slice(1).join(' ').replace(/\s*\([^)]*\)\s*$/, '').trim();
  const dose = doseFromName || r.dosage || '';
  const times = r.schedule?.times?.length ? r.schedule.times : ['As directed'];
  const scheduleLabel =
    r.schedule?.scheduleLabel ||
    (times.length === 1 ? `Once daily, ${times[0]}` : times.join(', '));
  return {
    id: `backend-${r.id}`,
    name,
    brand: name,
    category: backendCategoryToFrontend(r.category),
    form: 'tablet',
    regimen: [{ dose, route: 'Oral', time: times[0] || 'Morning' }],
    dose,
    route: 'Oral',
    times,
    scheduleLabel,
    dateAdded: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    startDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    status: r.archived_at ? 'archived' : 'active',
    gtin: r.gtin || undefined,
    dmdDisplayName: display,
  };
}

/** Pull backend cabinet into frontend medication shape (after demo swap). */
export async function pullCabinetFromBackend(): Promise<Medication[]> {
  const remote = await apiFetch<BackendMed[]>('/medications?status=all', { timeoutMs: SYNC_TIMEOUT_MS });
  return remote.map(backendRowToMedication);
}

/** Stable key for interaction cache so PDF regens when live checks finish. */
export function shareInteractionKey(interactions: { id: string; a: string; b: string }[]): string {
  return interactions
    .map((i) => `${i.id}:${i.a}:${i.b}`)
    .sort()
    .join('|');
}

/** Sync cabinet, create token with frozen snapshot for PDF/QR. */
export async function prepareGpShare(
  medications: Medication[],
  patientLabel: string | undefined,
  snapshot: ShareSnapshot,
): Promise<ShareTokenResponse> {
  try {
    await syncCabinetToBackend(medications);
  } catch (e) {
    throw new Error(`Could not sync medications: ${formatApiReachabilityError(e)}`);
  }
  let tokenRes: ShareTokenResponse;
  try {
    tokenRes = await createGpShareToken(patientLabel, snapshot);
  } catch (e) {
    throw new Error(`Could not create share link: ${formatApiReachabilityError(e)}`);
  }
  // No interaction check fired here on purpose: the PDF renders from the client
  // snapshot, and an extra full check would spend MedData quota for nothing.
  return tokenRes;
}
