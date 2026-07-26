import type { Category, MedForm } from '../data/types';
import { apiFetch } from './api';

export interface DmdLookupResult {
  found: boolean;
  display_name: string;
  gtin?: string;
  dmd_codes?: { ampp?: string; vmp?: string };
  form?: string;
  strength?: string;
  vtm_name?: string;
}

export interface MappedLookupFields {
  name: string;
  brand: string;
  dose: string;
  form: MedForm;
  category: Category;
  gtin?: string;
  dmdDisplayName?: string;
  dmdCodes?: { ampp?: string; vmp?: string };
}

const FORM_MAP: Record<string, MedForm> = {
  tablet: 'tablet',
  tablets: 'tablet',
  capsule: 'capsule',
  capsules: 'capsule',
  liquid: 'liquid',
  solution: 'liquid',
  suspension: 'liquid',
  inhaler: 'inhaler',
  inhalation: 'inhaler',
  injection: 'injection',
  injectable: 'injection',
};

function mapForm(raw?: string): MedForm {
  if (!raw) return 'tablet';
  const key = raw.toLowerCase().trim();
  for (const [k, v] of Object.entries(FORM_MAP)) {
    if (key.includes(k)) return v;
  }
  return 'other';
}

function parseBrand(displayName: string, vtm?: string): string {
  const paren = /\(([^)]+)\)/.exec(displayName);
  if (paren?.[1] && !/sample|demo/i.test(paren[1])) return paren[1].trim();
  const v = (vtm || '').trim();
  if (!v) return '';
  const first = displayName.split(/\s+/)[0]?.toLowerCase();
  if (first && v.toLowerCase().startsWith(first)) return '';
  return '';
}

export function mapDmdToFields(row: DmdLookupResult): MappedLookupFields {
  const display = row.display_name?.trim() || '';
  const vtm = row.vtm_name?.trim() || '';
  const name = vtm || display.split(/\s+/)[0] || display;
  const dose = row.strength?.trim() || '';
  return {
    name,
    brand: parseBrand(display, vtm),
    dose,
    form: mapForm(row.form),
    category: 'OTC',
    gtin: row.gtin,
    dmdDisplayName: display || undefined,
    dmdCodes: row.dmd_codes,
  };
}

/** FNC1 group separator, plus the AIM symbology identifier some readers prefix. The control
 *  characters are the point here — GS1 delimits variable-length fields with GS (U+001D). */
// eslint-disable-next-line no-control-regex
const GS1_SEPARATORS = /[\u001d\u001e\u0004]/g;
const AIM_IDENTIFIER = /^\][A-Za-z]\d/;
/** Application identifier 01 carries the GTIN-14 in a GS1 element string. */
// eslint-disable-next-line no-control-regex
const GS1_GTIN = /(?:^|[\u001d\u001e\u0004])01(\d{14})/;

/** Normalise a raw scan to something `/lookup/barcode` can resolve.
 *
 *  EAN-13 / UPC / ITF-14 come back as bare digits and pass through untouched — the backend
 *  already matches on both the raw code and its zero-padded GTIN-14 form. A DataMatrix or
 *  GS1-128 on an FMD pack instead returns an element string like
 *  `010506061234567817260131101A2B3C`, where only the 14 digits after AI `01` are the GTIN;
 *  posting the whole string would always 404. */
export function gtinFromScan(raw: string): string {
  let text = raw.trim();
  if (AIM_IDENTIFIER.test(text)) text = text.slice(3);
  if (/^\d+$/.test(text) && [8, 12, 13, 14].includes(text.length)) return text;
  const match = GS1_GTIN.exec(text);
  if (match) return match[1];
  return text.replace(GS1_SEPARATORS, '');
}

export async function lookupBarcode(code: string): Promise<MappedLookupFields> {
  const row = await apiFetch<DmdLookupResult>('/lookup/barcode', {
    method: 'POST',
    body: JSON.stringify({ code: gtinFromScan(code), code_type: 'gtin' }),
  });
  return mapDmdToFields(row);
}
