import type { Interaction, Medication } from '../data/types';
import {
  getCachedInteractions,
  getInteractionByIdCached,
  getInteractionCacheKey,
  getLastInteractionError,
  getLiveRefreshState,
  getSourcesStatus,
  getStaleInteractionReason,
  setInteractionCache,
  setLiveRefreshState,
  setSourcesStatus,
  setStaleInteractionReason,
} from './interaction-cache';
import { formatApiReachabilityError } from './api';
import {
  checkInteractionsLive,
  describeSourceProblem,
  type LiveCheckOptions,
  type SourcesStatus,
} from './interactions-live';
import { interactionCabinetFingerprint, cabinetWithPending, pendingMedForCheck } from './sync-cabinet';

const norm = (s: string) => s.trim().toLowerCase();

function medsCacheKey(meds: Medication[]): string {
  return interactionCabinetFingerprint(meds);
}

const FRESH_CHECK_MS = 60_000;
let lastFreshCheckAt = 0;
let lastFreshCheckKey = '';

/** Call after a trusted live check (e.g. add-flow save) to skip redundant Home refresh. */
export function markInteractionCheckFresh(meds: Medication[]): void {
  lastFreshCheckAt = Date.now();
  lastFreshCheckKey = medsCacheKey(meds);
}

/** Skip post-add Home refresh reuse when the add-flow result may be stale. */
export function invalidateInteractionFreshSkip(): void {
  lastFreshCheckAt = 0;
  lastFreshCheckKey = '';
}

let inflight: Promise<Interaction[]> | null = null;
let inflightKey = '';

/** Thrown when a pre-save check cannot trust an empty result (MedData down, etc.). */
export class InteractionCheckIncompleteError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'InteractionCheckIncompleteError';
    this.reason = reason;
  }
}

function filterInteractionsForCabinet(meds: Medication[], cached: Interaction[]): Interaction[] {
  const present = new Set(meds.filter((m) => m.status === 'active').map((m) => norm(m.name)));
  return cached.filter((rule) => present.has(norm(rule.a)) && present.has(norm(rule.b)));
}

/** Sync read from last successful backend refresh. No demo fixture fallback. */
export function checkInteractions(meds: Medication[]): Interaction[] {
  const refreshState = getLiveRefreshState();
  const cached = getCachedInteractions();
  if (refreshState === 'error') {
    return cached.length ? filterInteractionsForCabinet(meds, cached) : [];
  }
  if (refreshState !== 'ready' && refreshState !== 'loading') {
    return [];
  }
  return filterInteractionsForCabinet(meds, cached);
}

export function getInteractionRefreshError(): string | null {
  return getLastInteractionError();
}

export function getInteractionSources(): SourcesStatus {
  return getSourcesStatus();
}

export { getStaleInteractionReason };

/**
 * Reason an empty result is not trustworthy, or null when every source answered.
 * Guards against a dead API rendering as a clean "no interactions found".
 */
export function getIncompleteCheckReason(): string | null {
  return describeSourceProblem(getSourcesStatus());
}

export interface RefreshInteractionsOptions extends Pick<LiveCheckOptions, 'onProgress' | 'forceSync' | 'pendingMeds'> {
  force?: boolean;
  /** When false, never reuse a previous cache on failure (used before saving a new med). */
  allowStaleCache?: boolean;
}

function applyRefreshResult(
  key: string,
  list: Interaction[],
  sources: SourcesStatus,
  opts?: RefreshInteractionsOptions,
): Interaction[] {
  const problem = describeSourceProblem(sources);
  const allowStale = opts?.allowStaleCache !== false;

  if (problem && list.length === 0) {
    const prev = getCachedInteractions();
    if (allowStale && prev.length > 0) {
      setStaleInteractionReason(problem);
      setInteractionCache(prev, key);
      setSourcesStatus(sources);
      setLiveRefreshState('ready', null);
      return prev;
    }
    setStaleInteractionReason(null);
    setInteractionCache([], key);
    setSourcesStatus(sources);
    setLiveRefreshState('ready', null);
    return [];
  }

  setStaleInteractionReason(null);
  setInteractionCache(list, key);
  setSourcesStatus(sources);
  setLiveRefreshState('ready', null);
  return list;
}

function shouldUseCachedRefresh(meds: Medication[], opts?: RefreshInteractionsOptions): boolean {
  if (opts?.force) return false;
  const key = medsCacheKey(meds);
  if (getLiveRefreshState() === 'ready' && getInteractionCacheKey() === key) {
    return true;
  }
  const now = Date.now();
  if (
    getLiveRefreshState() === 'ready' &&
    now - lastFreshCheckAt < FRESH_CHECK_MS &&
    key === lastFreshCheckKey
  ) {
    return true;
  }
  return false;
}

export async function refreshInteractions(
  meds: Medication[],
  opts?: RefreshInteractionsOptions,
): Promise<Interaction[]> {
  const key = medsCacheKey(meds);
  if (inflight && inflightKey === key) return inflight;

  if (shouldUseCachedRefresh(meds, opts)) {
    return getCachedInteractions();
  }

  inflightKey = key;
  setLiveRefreshState('loading', null);

  inflight = checkInteractionsLive(meds, {
    onProgress: opts?.onProgress,
    forceSync: opts?.forceSync,
    pendingMeds: opts?.pendingMeds,
  })
    .then((result) => {
      markInteractionCheckFresh(meds);
      return applyRefreshResult(key, result.interactions, result.sources, opts);
    })
    .catch((e) => {
      const msg = formatApiReachabilityError(e);
      const prev = getCachedInteractions();
      const allowStale = opts?.allowStaleCache !== false;
      if (allowStale && prev.length > 0) {
        setStaleInteractionReason(msg);
        setLiveRefreshState('ready', null);
        return prev;
      }
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

function interactionInvolvesMed(med: Medication, rule: { a: string; b: string }): boolean {
  const names = new Set<string>();
  const add = (s: string) => {
    const n = norm(s);
    if (n) names.add(n);
  };
  add(med.name);
  if (med.dmdDisplayName) add(med.dmdDisplayName);
  add(`${med.name} ${med.dose}`.trim());
  const a = norm(rule.a);
  const b = norm(rule.b);
  for (const n of names) {
    if (a === n || b === n) return true;
    if (a.includes(n) || b.includes(n) || n.includes(a) || n.includes(b)) return true;
  }
  return false;
}

export async function interactionsForAsync(med: Medication, existing: Medication[]): Promise<Interaction[]> {
  const others = existing.filter((m) => m.id !== med.id && m.status === 'active');
  if (!others.length) return [];
  const cabinet = cabinetWithPending(existing, med);
  const list = await refreshInteractions(cabinet, {
    force: true,
    allowStaleCache: false,
    forceSync: true,
    pendingMeds: [pendingMedForCheck(med)],
  });
  const problem = getIncompleteCheckReason();
  if (problem) {
    throw new InteractionCheckIncompleteError(problem);
  }
  return list.filter((i) => interactionInvolvesMed(med, i));
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
