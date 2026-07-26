import type { Interaction, Medication } from '../data/types';
import {
  getCachedInteractions,
  getInteractionByIdCached,
  getInteractionCacheKey,
  getLastInteractionError,
  getLiveRefreshState,
  getSourcesStatus,
  setInteractionCache,
  setLiveRefreshState,
  setSourcesStatus,
} from './interaction-cache';
import { formatApiReachabilityError } from './api';
import {
  checkInteractionsLive,
  describeSourceProblem,
  type LiveCheckOptions,
  type SourcesStatus,
} from './interactions-live';

const norm = (s: string) => s.trim().toLowerCase();

function medsCacheKey(meds: Medication[]): string {
  return meds
    .map((m) => `${m.id}:${m.status}:${m.name}:${m.dose}`)
    .sort()
    .join('|');
}

let inflight: Promise<Interaction[]> | null = null;
let inflightKey = '';

/** Sync read from last successful backend refresh. No demo fixture fallback. */
export function checkInteractions(meds: Medication[]): Interaction[] {
  const state = getLiveRefreshState();
  if (state !== 'ready') return [];
  const cached = getCachedInteractions();
  const present = new Set(meds.filter((m) => m.status === 'active').map((m) => norm(m.name)));
  return cached.filter((rule) => present.has(norm(rule.a)) && present.has(norm(rule.b)));
}

export function getInteractionRefreshError(): string | null {
  return getLastInteractionError();
}

export function getInteractionSources(): SourcesStatus {
  return getSourcesStatus();
}

/**
 * Reason an empty result is not trustworthy, or null when every source answered.
 * Guards against a dead API rendering as a clean "no interactions found".
 */
export function getIncompleteCheckReason(): string | null {
  return describeSourceProblem(getSourcesStatus());
}

export interface RefreshInteractionsOptions extends Pick<LiveCheckOptions, 'onProgress'> {}

export async function refreshInteractions(
  meds: Medication[],
  opts?: RefreshInteractionsOptions & { force?: boolean },
): Promise<Interaction[]> {
  const key = medsCacheKey(meds);
  if (inflight && inflightKey === key) return inflight;

  // Every screen refreshes on mount. Without this the same cabinet is re-checked
  // on each navigation, and MedData is metered, so repeats cost real quota.
  if (!opts?.force && getLiveRefreshState() === 'ready' && getInteractionCacheKey() === key) {
    return getCachedInteractions();
  }

  inflightKey = key;
  setLiveRefreshState('loading', null);

  inflight = checkInteractionsLive(meds, { onProgress: opts?.onProgress })
    .then((result) => {
      setInteractionCache(result.interactions, key);
      setSourcesStatus(result.sources);
      setLiveRefreshState('ready', null);
      return result.interactions;
    })
    .catch((e) => {
      const msg = formatApiReachabilityError(e);
      setLiveRefreshState('error', msg);
      throw e;
    })
    .finally(() => {
      if (inflightKey === key) {
        inflight = null;
        inflightKey = '';
      }
    });

  return inflight;
}

export async function interactionsForAsync(med: Medication, existing: Medication[]): Promise<Interaction[]> {
  const others = existing.filter((m) => m.id !== med.id && m.status === 'active');
  if (!others.length) return [];
  const merged = [...others, { ...med, status: 'active' as const }];
  const name = norm(med.name);
  // Route through refreshInteractions so the result is cached and the screens
  // that mount afterwards reuse it instead of re-checking the same cabinet.
  const list = await refreshInteractions(merged);
  return list.filter((i) => norm(i.a) === name || norm(i.b) === name);
}

/** @deprecated sync — use interactionsForAsync */
export function interactionsFor(med: Medication, existing: Medication[]): Interaction[] {
  return checkInteractions([...existing, med]).filter((i) => {
    const name = norm(med.name);
    return norm(i.a) === name || norm(i.b) === name;
  });
}

export function flaggedMedNames(meds: Medication[]): Set<string> {
  const active = checkInteractions(meds);
  const names = new Set<string>();
  for (const i of active) {
    names.add(norm(i.a));
    names.add(norm(i.b));
  }
  return names;
}

export function getInteractionById(id: string): Interaction | undefined {
  return getInteractionByIdCached(id);
}
