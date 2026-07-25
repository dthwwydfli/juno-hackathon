import type { Interaction } from '../data/types';
import type { LiveRefreshState } from './interactions-live';

let cached: Interaction[] = [];
let refreshState: LiveRefreshState = 'idle';
let lastError: string | null = null;

export function setInteractionCache(list: Interaction[]): void {
  cached = list;
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
