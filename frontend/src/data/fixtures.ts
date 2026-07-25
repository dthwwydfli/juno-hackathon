import type { AppState, Interaction, Medication, Profile, SyncEntry } from './types';

export const profile: Profile = {
  name: 'Jordan Ellis',
  age: 34,
  gender: 'Female',
  nhsNumber: '485 777 3456',
  conditions: ['Penicillin allergy', 'Type 2 diabetes'],
  nhsLinked: true,
};

export const medications: Medication[] = [
  {
    id: 'atorvastatin', name: 'Atorvastatin', brand: 'Lipitor', category: 'NHS', form: 'tablet',
    regimen: [{ dose: '20 mg', route: 'Oral', time: 'Evening' }],
    dose: '20 mg', route: 'Oral', times: ['Evening'], scheduleLabel: 'Once daily, evening',
    dateAdded: '24 Jul 2026', startDate: '24 Jul 2026', status: 'active',
    dmdDisplayName: 'Atorvastatin 20mg film-coated tablets',
  },
  {
    id: 'warfarin', name: 'Warfarin', brand: 'Marevan', category: 'NHS', form: 'tablet',
    regimen: [{ dose: '3 mg', route: 'Oral', time: 'Evening' }],
    dose: '3 mg', route: 'Oral', times: ['Evening'], scheduleLabel: 'Once daily, evening',
    dateAdded: '24 Jul 2026', startDate: '24 Jul 2026', status: 'active',
    dmdDisplayName: 'Warfarin 3mg tablets',
  },
  {
    id: 'aspirin', name: 'Aspirin', brand: 'Dispersible aspirin', category: 'NHS', form: 'tablet',
    regimen: [{ dose: '300 mg', route: 'Oral', time: 'Morning' }],
    dose: '300 mg', route: 'Oral', times: ['Morning'], scheduleLabel: 'Once daily, morning',
    dateAdded: '24 Jul 2026', startDate: '24 Jul 2026', status: 'active',
    dmdDisplayName: 'Aspirin 300mg tablets (demo GTIN)',
  },
  {
    id: 'ramipril', name: 'Ramipril', brand: 'Tritace', category: 'NHS', form: 'capsule',
    regimen: [{ dose: '5 mg', route: 'Oral', time: 'Morning' }],
    dose: '5 mg', route: 'Oral', times: ['Morning'], scheduleLabel: 'Once daily, morning',
    dateAdded: '24 Jul 2026', startDate: '24 Jul 2026', status: 'active',
  },
  {
    id: 'metformin', name: 'Metformin', brand: 'Glucophage', category: 'NHS', form: 'tablet',
    regimen: [
      { dose: '500 mg', route: 'Oral', time: 'Morning' },
      { dose: '500 mg', route: 'Oral', time: 'Evening' },
    ],
    dose: '500 mg', route: 'Oral', times: ['Morning', 'Evening'], scheduleLabel: 'Twice daily, with meals',
    dateAdded: '24 Jul 2026', startDate: '24 Jul 2026', status: 'active',
  },
  {
    id: 'ibuprofen', name: 'Ibuprofen', brand: 'Nurofen', category: 'OTC', form: 'tablet',
    regimen: [{ dose: '200 mg', route: 'Oral', time: 'As needed' }],
    dose: '200 mg', route: 'Oral', times: ['As needed'], scheduleLabel: 'As needed',
    dateAdded: '25 Jul 2026', startDate: '25 Jul 2026', status: 'active',
    dmdDisplayName: 'Ibuprofen 200mg tablets (sample)',
  },
  {
    id: 'fish-oil', name: 'Fish oil', brand: 'Seven Seas', category: 'Private', form: 'capsule',
    regimen: [{ dose: '1000 mg', route: 'Oral', time: 'Midday' }],
    dose: '1000 mg', route: 'Oral', times: ['Midday'], scheduleLabel: 'Once daily',
    dateAdded: '20 Jul 2026', startDate: '20 Jul 2026', status: 'active',
    dmdDisplayName: 'Fish oil 1000mg capsules',
  },
  {
    id: 'grapefruit-juice', name: 'Grapefruit juice', brand: 'Fresh', category: 'Private', form: 'liquid',
    regimen: [{ dose: '1 glass', route: 'Oral', time: 'Morning' }],
    dose: '1 glass', route: 'Oral', times: ['Morning'], scheduleLabel: 'With breakfast',
    dateAdded: '22 Jul 2026', startDate: '22 Jul 2026', status: 'active',
    dmdDisplayName: 'Grapefruit juice (online)',
  },
  // Archived — the NHS courses here auto-archived when their duration ended.
  { id: 'amoxicillin', name: 'Amoxicillin', brand: 'Amoxil', category: 'NHS', form: 'capsule', regimen: [{ dose: '500 mg', route: 'Oral', time: 'Morning' }], dose: '500 mg', route: 'Oral', times: ['Three times daily'], scheduleLabel: 'Course completed', durationLabel: '1-week course', dateAdded: '02 May 2026', endDate: '2026-05-09', status: 'archived' },
  { id: 'prednisolone', name: 'Prednisolone', brand: 'Deltacortril', category: 'NHS', form: 'tablet', regimen: [{ dose: '5 mg', route: 'Oral', time: 'Morning' }], dose: '5 mg', route: 'Oral', times: ['Morning'], scheduleLabel: 'Course completed', durationLabel: '2-week course', dateAdded: '11 Apr 2026', endDate: '2026-04-25', status: 'archived' },
  { id: 'codeine', name: 'Codeine', brand: 'Codeine phosphate', category: 'NHS', form: 'tablet', regimen: [{ dose: '30 mg', route: 'Oral', time: 'As needed' }], dose: '30 mg', route: 'Oral', times: ['As needed'], scheduleLabel: 'Course completed', dateAdded: '11 Apr 2026', status: 'archived' },
  { id: 'omeprazole', name: 'Omeprazole', brand: 'Losec', category: 'NHS', form: 'capsule', regimen: [{ dose: '20 mg', route: 'Oral', time: 'Morning' }], dose: '20 mg', route: 'Oral', times: ['Morning'], scheduleLabel: 'Stopped', dateAdded: '01 Mar 2026', status: 'archived' },
  { id: 'cetirizine', name: 'Cetirizine', brand: 'Zirtek', category: 'OTC', form: 'tablet', regimen: [{ dose: '10 mg', route: 'Oral', time: 'Morning' }], dose: '10 mg', route: 'Oral', times: ['Morning'], scheduleLabel: 'Stopped', dateAdded: '18 Feb 2026', status: 'archived' },
  { id: 'naproxen', name: 'Naproxen', brand: 'Naprosyn', category: 'NHS', form: 'tablet', regimen: [{ dose: '250 mg', route: 'Oral', time: 'Morning' }], dose: '250 mg', route: 'Oral', times: ['Twice daily'], scheduleLabel: 'Course completed', dateAdded: '05 Jan 2026', status: 'archived' },
];

/** Legacy fixture table; interaction UI uses live MedData via the backend. */
export const interactionRules: Interaction[] = [];

export const syncLog: SyncEntry[] = [
  { version: 14, summary: '2 prescriptions added', mode: 'Manual', datetime: '25 Jul 2026, 09:41' },
  { version: 13, summary: 'No changes', mode: 'Auto', datetime: '24 Jul 2026, 07:00' },
  { version: 12, summary: 'Dose updated · Ramipril 5 mg', mode: 'Auto', datetime: '20 Jul 2026, 07:00' },
  { version: 11, summary: '1 medication archived', mode: 'Auto', datetime: '14 Jul 2026, 07:00' },
];

export const initialState: AppState = {
  profile,
  medications,
  syncLog,
  lastSynced: '25 Jul 2026, 09:41',
  onboarded: false,
};
