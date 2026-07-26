import type { Medication } from '../data/types';

/**
 * Dose scheduling.
 *
 * There was no notion of time-of-day anywhere in the app — `dates.ts` is
 * entirely date-only, with no parser, no relative formatter and no concept of
 * "next". This module adds the minimum needed to answer "what do I take next?".
 *
 * The awkward part is that `Medication.times` is not one format. It mixes:
 *   - named slots        'Morning' | 'Midday' | 'Evening'   (all current fixtures)
 *   - clock strings      '10:30 AM'                          (only the Add form emits these)
 *   - frequency phrases  'As needed' | 'Twice daily'         (not times at all)
 * All three have to be handled, and the third has to be excluded rather than
 * guessed at — showing "next dose: Twice daily" would be worse than showing
 * nothing.
 */

/** Named slots → minutes past midnight. Deliberately conservative hours: these
 *  are what a UK patient leaflet means by "morning" and "evening". */
const SLOTS: Record<string, number> = {
  morning: 8 * 60,
  breakfast: 8 * 60,
  midday: 13 * 60,
  noon: 12 * 60,
  lunch: 13 * 60,
  afternoon: 15 * 60,
  evening: 19 * 60,
  dinner: 19 * 60,
  night: 22 * 60,
  bedtime: 22 * 60,
};

/** Frequencies and on-demand markers — real values in the data, but not times. */
const NOT_A_TIME = /as\s*needed|when\s*required|\bprn\b|daily|times?\s*a\s*day|weekly|hourly|with\s*meals/i;

/** Matches the clock format the Add form writes (`Add.tsx` builds `H:MM AM/PM`). */
const CLOCK = /(\d{1,2}):(\d{2})\s*(AM|PM)/i;

/** Minutes past midnight for a schedule string, or null if it isn't a time. */
export function parseTimeToMinutes(raw?: string): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  const clock = CLOCK.exec(s);
  if (clock) {
    let h = Number(clock[1]) % 12;
    if (clock[3].toUpperCase() === 'PM') h += 12;
    return h * 60 + Number(clock[2]);
  }

  // Check the frequency guard only after the clock test, so a real time is
  // never discarded by a stray word next to it.
  if (NOT_A_TIME.test(s)) return null;

  const slot = SLOTS[s.toLowerCase()];
  return slot ?? null;
}

/** "19:00" → "7:00 PM". */
export function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ap = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

export interface ScheduledDose {
  med: Medication;
  dose: string;
  /** Minutes past midnight. */
  minutes: number;
  /** True when the dose falls on the following day. */
  tomorrow: boolean;
}

/** Every schedulable dose for one medication, from `regimen` where available —
 *  it carries its own dose per row — falling back to the flattened `times`. */
function dosesFor(med: Medication): { dose: string; minutes: number }[] {
  const out: { dose: string; minutes: number }[] = [];

  if (med.regimen?.length) {
    for (const row of med.regimen) {
      const minutes = parseTimeToMinutes(row.time);
      if (minutes !== null) out.push({ dose: row.dose || med.dose, minutes });
    }
  }

  if (!out.length) {
    for (const t of med.times ?? []) {
      const minutes = parseTimeToMinutes(t);
      if (minutes !== null) out.push({ dose: med.dose, minutes });
    }
  }

  return out;
}

/**
 * The next dose due across a cabinet. Rolls into tomorrow once the day's last
 * dose has passed, so the block never reads as empty just because it's late.
 * Returns null when nothing is schedulable (e.g. an all-"As needed" cabinet).
 */
export function nextDose(meds: Medication[], now: Date = new Date()): ScheduledDose | null {
  const nowMins = now.getHours() * 60 + now.getMinutes();

  let best: ScheduledDose | null = null;
  const consider = (c: ScheduledDose) => {
    if (!best) { best = c; return; }
    const rank = (d: ScheduledDose) => (d.tomorrow ? 1 : 0) * 10000 + d.minutes;
    if (rank(c) < rank(best)) best = c;
  };

  for (const med of meds) {
    if (med.status !== 'active') continue;
    for (const d of dosesFor(med)) {
      consider({ med, dose: d.dose, minutes: d.minutes, tomorrow: d.minutes < nowMins });
    }
  }

  return best;
}

/** "in 2h 15m", "in 45m", "now". Not a duration formatter — it is tuned for
 *  the one sentence it appears in. */
export function formatUntil(dose: ScheduledDose, now: Date = new Date()): string {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  let delta = dose.minutes - nowMins;
  if (dose.tomorrow) delta += 24 * 60;

  if (delta <= 0) return 'now';
  if (delta < 60) return `in ${delta}m`;

  const h = Math.floor(delta / 60);
  const m = delta % 60;
  if (h >= 12) return dose.tomorrow ? 'tomorrow' : `in ${h}h`;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}
