export type Category = 'NHS' | 'Private' | 'OTC';
export type MedForm = 'tablet' | 'capsule' | 'liquid' | 'inhaler' | 'injection' | 'other';

/** One dose in a day's regimen: a specific amount, by a route, at a time.
 *  A medication can have several (e.g. 500 mg morning + 500 mg evening). */
export interface DoseRow {
  dose: string;   // e.g. "500 mg"
  route: string;  // e.g. "Oral"
  time: string;   // e.g. "8:00 AM" or "Morning"
}

export interface Medication {
  id: string;
  name: string;          // generic / medical name, e.g. "Atorvastatin"
  brand: string;         // colloquial / brand name, e.g. "Lipitor"
  category: Category;
  form: MedForm;
  regimen: DoseRow[];    // one or more (dose · route · time) rows per day
  // Derived summary fields (kept for cards / summary / PDF; = regimen[0] + all times)
  dose: string;          // e.g. "20 mg"
  route: string;         // e.g. "Oral"
  times: string[];       // e.g. ["Evening"] or ["10:30 AM", "8:00 PM"]
  scheduleLabel?: string; // human summary shown on the card, e.g. "Once daily, evening"
  dateAdded: string;     // "25 Jul 2026"
  startDate?: string;    // "25 Jul 2026"
  // NHS courses carry a duration from the NHS record and auto-archive when it ends.
  endDate?: string;      // ISO "2026-08-08" — when set and past, the med auto-archives
  durationLabel?: string; // e.g. "2-week course" (shown for NHS courses)
  status: 'active' | 'archived';
  gtin?: string;
  dmdDisplayName?: string;
  dmdCodes?: { ampp?: string; vmp?: string };
}

export interface InteractionEffect {
  label: string;         // amber chip, e.g. "Blood pressure"
}

export interface Interaction {
  id: string;                 // stable id for the pair, e.g. "ramipril-ibuprofen"
  a: string;                  // medication name A
  b: string;                  // medication name B
  aCategory: Category;
  bCategory: Category;
  reason: string;             // plain-English summary
  detail: string;             // "What happens" longer text
  affects: InteractionEffect[]; // "What it may affect" amber chips
  goodToKnow: string[];       // bullets
  source: string;             // e.g. "NHS · BNF"
}

export interface Profile {
  name: string;
  age: number;
  gender: string;
  nhsNumber: string;
  conditions: string[];      // allergies / conditions
  nhsLinked: boolean;
}

export interface SyncEntry {
  version: number;           // 14, 13, ...
  summary: string;           // "2 prescriptions added"
  mode: 'Auto' | 'Manual';
  datetime: string;          // "25 Jul 2026, 09:41"
}

export interface AppState {
  profile: Profile;
  medications: Medication[];
  syncLog: SyncEntry[];
  lastSynced: string;        // "25 Jul 2026, 09:41"
  onboarded: boolean;
}
