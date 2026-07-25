import type { Interaction, Medication } from '../data/types';
import {
  getCachedInteractions,
  getInteractionByIdCached,
  getLastInteractionError,
  getLiveRefreshState,
  setInteractionCache,
  setLiveRefreshState,
} from './interaction-cache';
import { formatApiReachabilityError } from './api';
import { checkInteractionsLive, interactionsForLive, type LiveCheckOptions } from './interactions-live';

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

export interface RefreshInteractionsOptions extends Pick<LiveCheckOptions, 'onProgress'> {}

export async function refreshInteractions(
  meds: Medication[],
  opts?: RefreshInteractionsOptions,
): Promise<Interaction[]> {
  const key = medsCacheKey(meds);
  if (inflight && inflightKey === key) return inflight;

  inflightKey = key;
  setLiveRefreshState('loading', null);

  inflight = checkInteractionsLive(meds, { onProgress: opts?.onProgress })
    .then((result) => {
      setInteractionCache(result.interactions);
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
  return interactionsForLive(med, existing);
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
