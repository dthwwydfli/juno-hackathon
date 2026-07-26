import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { AppState, Medication, Profile, SyncEntry } from './types';
import { initialState } from './fixtures';
import { isPast } from '../lib/dates';

const STORAGE_KEY = 'piyp:state:v4';

/** NHS courses carry an end date; once it has passed the medication auto-archives
 *  with no user action (the duration comes from the NHS record). */
function applyAutoArchive(state: AppState): AppState {
  let changed = false;
  const medications = state.medications.map((m) => {
    if (m.status === 'active' && isPast(m.endDate)) {
      changed = true;
      return { ...m, status: 'archived' as const, scheduleLabel: 'Course completed' };
    }
    return m;
  });
  return changed ? { ...state, medications } : state;
}

type Action =
  | { type: 'addMedication'; med: Medication }
  | { type: 'updateMedication'; med: Medication }
  | { type: 'archiveMedication'; id: string }
  | { type: 'restoreMedication'; id: string }
  | { type: 'updateProfile'; profile: Partial<Profile> }
  | { type: 'setOnboarded'; value: boolean }
  | { type: 'syncNow'; entry: SyncEntry; lastSynced: string }
  | { type: 'setMedications'; medications: Medication[] }
  | { type: 'reset' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addMedication':
      return { ...state, medications: [action.med, ...state.medications] };
    case 'updateMedication':
      return { ...state, medications: state.medications.map((m) => (m.id === action.med.id ? action.med : m)) };
    case 'archiveMedication':
      return { ...state, medications: state.medications.map((m) => (m.id === action.id ? { ...m, status: 'archived' } : m)) };
    case 'restoreMedication':
      return { ...state, medications: state.medications.map((m) => (m.id === action.id ? { ...m, status: 'active' } : m)) };
    case 'updateProfile':
      return { ...state, profile: { ...state.profile, ...action.profile } };
    case 'setOnboarded':
      return { ...state, onboarded: action.value };
    case 'syncNow':
      return { ...state, syncLog: [action.entry, ...state.syncLog], lastSynced: action.lastSynced };
    case 'setMedications':
      return { ...state, medications: action.medications };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return applyAutoArchive(initialState);
    const saved = JSON.parse(raw) as Partial<AppState>;
    // `profile` is merged a level deeper than the rest: a top-level spread
    // replaces the whole object, so a state persisted before a field was added
    // to Profile would come back with that field undefined.
    return applyAutoArchive({
      ...initialState,
      ...saved,
      profile: { ...initialState.profile, ...saved.profile },
    });
  } catch { /* ignore */ }
  return applyAutoArchive(initialState);
}

interface StoreValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  // convenience helpers
  addMedication: (med: Medication) => void;
  updateMedication: (med: Medication) => void;
  archiveMedication: (id: string) => void;
  restoreMedication: (id: string) => void;
  updateProfile: (p: Partial<Profile>) => void;
  setOnboarded: (v: boolean) => void;
  syncNow: (entry: SyncEntry, lastSynced: string) => void;
  setMedications: (medications: Medication[]) => void;
  reset: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const value = useMemo<StoreValue>(() => ({
    state,
    dispatch,
    addMedication: (med) => dispatch({ type: 'addMedication', med }),
    updateMedication: (med) => dispatch({ type: 'updateMedication', med }),
    archiveMedication: (id) => dispatch({ type: 'archiveMedication', id }),
    restoreMedication: (id) => dispatch({ type: 'restoreMedication', id }),
    updateProfile: (profile) => dispatch({ type: 'updateProfile', profile }),
    setOnboarded: (value) => dispatch({ type: 'setOnboarded', value }),
    syncNow: (entry, lastSynced) => dispatch({ type: 'syncNow', entry, lastSynced }),
    setMedications: (medications) => dispatch({ type: 'setMedications', medications }),
    reset: () => dispatch({ type: 'reset' }),
  }), [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useActiveMeds(): Medication[] {
  const { state } = useStore();
  return state.medications.filter((m) => m.status === 'active');
}
