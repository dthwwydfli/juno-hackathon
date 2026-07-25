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

export async function lookupBarcode(code: string): Promise<MappedLookupFields> {
  const row = await apiFetch<DmdLookupResult>('/lookup/barcode', {
    method: 'POST',
    body: JSON.stringify({ code: code.trim(), code_type: 'gtin' }),
  });
  return mapDmdToFields(row);
}
