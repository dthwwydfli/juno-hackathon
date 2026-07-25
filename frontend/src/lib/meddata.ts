import { apiFetch } from './api';
import { primaryLookupName } from './drug-names';

export interface MedDataInteractionRow {
  item_1_name?: string;
  item_2_name?: string;
  description?: string;
  severity?: string;
  source?: string;
}

export interface MedDataCheckResult {
  interactions?: MedDataInteractionRow[];
  unavailable?: boolean;
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

function namesMatch(a: string, b: string, nameA: string, nameB: string): boolean {
  const na = norm(nameA);
  const nb = norm(nameB);
  const ia = norm(a);
  const ib = norm(b);
  if (new Set([na, nb]).size === 2 && new Set([ia, ib]).size === 2) {
    if (na === ia && nb === ib) return true;
    if (na === ib && nb === ia) return true;
  }
  const ta = na.split(/\s+/)[0];
  const tb = nb.split(/\s+/)[0];
  const ia0 = ia.split(/\s+/)[0];
  const ib0 = ib.split(/\s+/)[0];
  return new Set([ta, tb]).has(ia0) && new Set([ta, tb]).has(ib0);
}

export function findPairInMedDataResult(
  result: MedDataCheckResult | null,
  nameA: string,
  nameB: string,
): MedDataInteractionRow | null {
  if (!result?.interactions?.length) return null;
  for (const row of result.interactions) {
    const i1 = row.item_1_name || '';
    const i2 = row.item_2_name || '';
    if (namesMatch(i1, i2, nameA, nameB)) return row;
  }
  return null;
}

export async function checkMedDataBatch(itemNames: string[]): Promise<MedDataCheckResult | null> {
  const names = [...new Set(itemNames.map((n) => primaryLookupName(n)).filter(Boolean))].slice(0, 10);
  if (names.length < 2) return null;
  try {
    return await apiFetch<MedDataCheckResult>(
      `/proxy/meddata/interactions/check?items=${encodeURIComponent(names.join(','))}`,
      { timeoutMs: 35_000 },
    );
  } catch {
    return null;
  }
}

export async function checkMedDataPair(nameA: string, nameB: string): Promise<MedDataInteractionRow | null> {
  const result = await checkMedDataBatch([nameA, nameB]);
  return findPairInMedDataResult(result, nameA, nameB);
}
