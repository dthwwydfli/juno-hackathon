const MULTI_WORD = [
  'fish oil',
  'cod liver oil',
  'omega-3',
  'omega 3',
  'vitamin d',
  'vitamin c',
  'vitamin b12',
  'folic acid',
  "st john's wort",
  'coenzyme q10',
  'co q10',
  'ginkgo biloba',
  'grapefruit juice',
];

function clean(displayName: string): string {
  let text = displayName.trim();
  text = text.replace(/\([^)]*\)/g, ' ');
  text = text.replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|%|iu|mmol|units?)\b/gi, ' ');
  text = text.replace(
    /\b(tablets?|capsules?|caplets?|film[- ]coated|gastro[- ]resistant|hard|soft|chewable|effervescent|sachets?|solution|suspension|injection|cream|gel|ointment|patch|spray|drops?|powder|granules|modified[- ]release|prolonged[- ]release|mr|sr|xl|lozenges?)\b/gi,
    ' ',
  );
  text = text.replace(/\b(sample|demo|pack|pk|hospital|unit dose|blister|generic|brand)\b/gi, ' ');
  text = text.replace(/[^\w\s\-']/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

export function lookupQueryVariants(displayName: string): string[] {
  const raw = displayName.trim();
  const cleaned = clean(raw);
  const lowerRaw = raw.toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (q: string) => {
    const norm = q.replace(/\s+/g, ' ').trim();
    const key = norm.toLowerCase();
    if (norm.length < 2 || seen.has(key)) return;
    seen.add(key);
    out.push(norm);
  };

  for (const phrase of MULTI_WORD) {
    if (lowerRaw.includes(phrase)) add(phrase.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  if (cleaned) {
    add(cleaned);
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) add(parts.slice(0, 2).join(' '));
    if (parts[0]) add(parts[0]);
  }
  add(raw);
  return out;
}

export function primaryLookupName(displayName: string): string {
  const v = lookupQueryVariants(displayName);
  return v[0] || displayName.trim();
}

/** Label used for MedData / interaction checks from a cabinet med. */
export function medInteractionLabel(med: { name: string; dose?: string; dmdDisplayName?: string }): string {
  if (med.dmdDisplayName?.trim()) return med.dmdDisplayName.trim();
  const dose = med.dose?.trim();
  if (dose) return `${med.name.trim()} ${dose}`.trim();
  return med.name.trim();
}
