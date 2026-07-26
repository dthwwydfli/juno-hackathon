import type { Interaction } from '../data/types';
import type { LiveRefreshState, SourcesStatus } from './interactions-live';

let cached: Interaction[] = [];
let cachedKey = '';
let refreshState: LiveRefreshState = 'idle';
let lastError: string | null = null;
let lastSources: SourcesStatus = {};
let staleReason: string | null = null;

export function getStaleInteractionReason(): string | null {
  return staleReason;
}

export function setStaleInteractionReason(reason: string | null): void {
  staleReason = reason;
}

export function setInteractionCache(list: Interaction[], key = ''): void {
  cached = list;
  cachedKey = key;
}

/** Cabinet fingerprint the cached list was computed from. */
export function getInteractionCacheKey(): string {
  return cachedKey;
}

export function getInteractionByIdCached(id: string): Interaction | undefined {
  return cached.find((i) => i.id === id);
}

export function getCachedInteractions(): Interaction[] {
  return cached;
}

export function getLiveRefreshState(): LiveRefreshState {
  return refreshState;
}

export function setLiveRefreshState(state: LiveRefreshState, errorMessage?: string | null): void {
  refreshState = state;
  if (errorMessage !== undefined) lastError = errorMessage;
}

export function getLastInteractionError(): string | null {
  return lastError;
}

export function setSourcesStatus(sources: SourcesStatus): void {
  lastSources = sources;
}

export function getSourcesStatus(): SourcesStatus {
  return lastSources;
}
