const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** ISO (YYYY-MM-DD) → "08 Aug 2026". Falls back to the input if unparseable. */
export function fmtDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

/** Is this ISO date strictly before today? */
export function isPast(iso?: string): boolean {
  if (!iso) return false;
  return iso < todayISO();
}

/** Whole days from today until the ISO date (negative if past). */
export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const ms = new Date(iso + 'T00:00:00').getTime() - new Date(todayISO() + 'T00:00:00').getTime();
  return Math.round(ms / 86_400_000);
}

/** Add N days to an ISO date, returning ISO. */
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
