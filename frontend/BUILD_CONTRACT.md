# Screen build contract (Phase 1 agents read this first)

You are converting ONE cluster of static HTML mockups in `../designs/` into real React screens in this Vite + React + TS app. The **foundation is built** — reuse it, do not recreate it. Match the reference PNG renders (light **and** dark).

## Golden rules
1. **Fidelity:** the `designs/<screen>.html` markup + its `-light.png`/`-dark.png` renders are the source of truth. Reproduce layout, spacing, copy, and icons faithfully. Read the HTML file for exact structure/copy; look at the PNG for the visual.
2. **Reuse the foundation.** Import shared components, tokens, store, and libs (see API below). Only write *screen-specific* CSS (co-locate a `<screen>.css` next to the component and `import` it). The token block + reset + frame chrome already exist globally — never redefine `:root` tokens.
3. **Single amber, no grading (LEGAL):** interaction detail/reason/warning/GP-doc surfaces use `var(--amber)` / `var(--amber-ink)` / `var(--amber-tint)` only. One label “Potential interaction”. Never show High/Moderate severity, never red on an interaction surface. Every interaction/GP surface carries a not-medical-advice line (`<GpNote/>`) and NHS·BNF attribution where the mockup shows it.
4. **Real inputs & real state.** Build actual `<input>/<select>/<button>` controls (the mockups are fake divs). Wire to the store so changes persist.
5. **Theme-aware:** use CSS variables for every colour so light/dark both work. Never hard-code hex (except brand marks already handled in `Icon`).
6. **Navigation:** use `react-router` `useNavigate()` / `<Link>`. Keep the route paths already registered in `src/App.tsx` — DO NOT edit `App.tsx` or any file outside your assigned screen folders.
7. Keep each screen’s exported component **name and file path unchanged** (they’re imported by `App.tsx`). Replace the stub body.

## Foundation API you must use

### Frame — `src/components/Frame.tsx`
- `<PhoneFrame label?>…</PhoneFrame>` — the phone shell (adds `.home-ind`). Put a `StatusBar` + a `.screen-body` scroll container inside.
- `<StatusBar dark? />` — the 9:41 + signal/battery bar. `dark` forces white text (for dark hero screens like the barcode scanner).
- `<AppHeader title subtitle? />` — big title + persistent profile(→`/settings`) & QR(→`/share`) buttons. Use on Home & Interactions.
- `<SubHeader title onBack? right? />` — pushed-screen header (back chevron + centered title).
- `<BottomNav active?="interactions"|"share" />` — the 3-item nav (Interactions | ＋Add | Share). Only on Home & Interactions.
- `<GpNote>…</GpNote>` — the “information only — not medical advice” line (amber info icon).
- `<Modal onClose?>…</Modal>` and `<Sheet onClose?>…</Sheet>` — centered modal (warning) and bottom sheet (time picker). Backed by `.scrim/.modal-card/.sheet` in `components.css`.
- Layout: put scrolling content inside `<div className="screen-body">`. Add `padding-bottom` room when a `BottomNav` is present (nav is 96px).

### Icons — `src/components/Icon.tsx`
`<Icon name="…" size? strokeWidth? className? />`. Names: profile, qr, share, archive, chevron, chevronDown, back, close, check, warning, plus, tablet, capsule, liquid, inhaler, injection, camera, sync, search, calendar, clock, edit, lock, faceid, bell, info, external, apple, google, nhs, pill, shield, trash, settings, download, link. `medFormIcon[form]` maps a medication form to an icon name.

### MedCard — `src/components/MedCard.tsx`
`<MedCard med={Medication} flagged? onClick? />` — the home/list medication row (grey thumbnail with form glyph, name, brand, dose·schedule, chevron or amber warning badge).

### Forms — `src/components/form/Form.tsx`
`<Field label hint?>`, `<TextField label? hint? …inputProps>`, `<ChipGroup options value onChange>`, `<SelectField label? options value onChange>`. Styling in `form/form.css`.

### Store — `src/data/store.tsx`
`const s = useStore()` gives: `s.state` (`{profile, medications, syncLog, lastSynced, onboarded}`), and helpers `addMedication(med)`, `updateMedication(med)`, `archiveMedication(id)`, `restoreMedication(id)`, `updateProfile(partial)`, `setOnboarded(bool)`, `syncNow(entry, lastSynced)`, `reset()`. `useActiveMeds()` returns active meds. Persisted to localStorage automatically.

### Types — `src/data/types.ts`
`Medication {id,name,brand,category:'NHS'|'Private'|'OTC',form:'tablet'|'capsule'|'liquid'|'inhaler'|'injection'|'other',dose,route,times:string[],scheduleLabel?,dateAdded,startDate?,status:'active'|'archived'}`, plus `Interaction`, `Profile`, `SyncEntry`, `AppState`.

### Interactions — `src/lib/interactions.ts`
`checkInteractions(meds)` → active `Interaction[]`; `interactionsFor(med, existing)` → interactions a med introduces; `flaggedMedNames(meds)` → `Set<string>` of lowercased names to flag on Home; `getInteractionById(id)`.

### QR / PDF — `src/lib/qr.ts`, `src/lib/pdf.ts`
`buildSharePayload(state)` → string to encode; `qrDataUrl(text,{dark,light,size})` → data URL for `<img>`. `shareOrDownloadPdf(state)` → shares/downloads the real PDF; `pdfObjectUrl(state)` → blob URL for an inline `<iframe>` preview.

### Fixtures — `src/data/fixtures.ts`
Sample profile (Jordan Ellis, 34, NHS 485 777 3456). Active meds are a **MedData-oriented blend**: Atorvastatin, Warfarin, Aspirin, Ramipril, Metformin (NHS), Fish oil and Grapefruit juice (Private), Ibuprofen (OTC), plus archived courses. Pack-style `dmdDisplayName` on key rows matches backend MedData smoke names. `interactionRules` is empty — Home/Interactions use **live MedData** via `POST /interactions/check` only. `syncLog`.

## Verify your own work
The dev server runs at `http://localhost:5173`. Screenshot your screens:
`node tools/shoot.mjs <route> <name> both` → writes `shots/<name>-light.png` + `-dark.png`. Read those PNGs and compare against `../designs/<screen>-light.png` / `-dark.png`. Iterate until they match. Run `npx tsc -b --noEmit` (or `npm run build`) to ensure no type errors before finishing.
