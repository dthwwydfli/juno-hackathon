# Pocketary — frontend

Vite + React 19 + TypeScript. Installable as a PWA. Product overview and backend
setup live in the [root README](../README.md).

```bash
cp .env.example .env    # VITE_API_BASE_URL defaults to http://localhost:8000
npm install
npm run dev             # http://localhost:5173
```

| Script | Does |
|--------|------|
| `npm run dev` | Vite dev server, bound to `0.0.0.0` so a phone on the same Wi-Fi can reach it |
| `npm run build` | `tsc -b` then `vite build` — the build **fails** on Vercel if `VITE_API_BASE_URL` is unset or points at localhost |
| `npm run lint` | Oxlint |
| `npm run preview` | Serve `dist/` |

## Layout

```
src/
  App.tsx        route table + the iOS-style push/pop screen stack
  components/    Frame (PhoneShell/PhoneFrame/headers/nav), MedCard, Icon, form controls
  screens/       one folder per route, each with a co-located <screen>.css
  lib/           api client, interaction check + cache, cabinet sync, dm+d lookup, PDF, QR
  data/          store.tsx (reducer + localStorage), types.ts, fixtures.ts
  styles/        tokens.css (the only :root block), base.css, motion.css, texture.css
```

`data/store.tsx` is the UI source of truth and persists to localStorage;
`lib/sync-cabinet.ts` mirrors it to the backend for interaction checks and GP
share. Interaction results come **only** from `POST /interactions/check` — there
is no client-side fallback, so an API outage surfaces as a notice rather than as
"no interactions found".

## Conventions

- Colour, spacing, and type come from `styles/tokens.css`. Never hard-code a hex
  in a component, and never redeclare `:root`.
- Interaction and GP surfaces are amber-only with a single "Potential
  interaction" label — no High/Moderate grading, no red. Each one carries
  `<GpNote/>`. See [DESIGN.md](../DESIGN.md).
- The app renders in a 390×844 frame on desktop and full-bleed at ≤480px. Keep
  text inputs at 16px inside that breakpoint or iOS zooms on focus.

## Dev tooling (`tools/`, needs the dev server running)

```bash
node tools/shoot.mjs /home home        # shots/home-light.png + home-dark.png
node tools/e2e.mjs                     # add a med through the real form, assert it reaches Home
node tools/swipe-test.mjs              # swipe-to-archive on a med row
```

`shots/` is gitignored — regenerate rather than commit. The nine marketing PNGs
in `public/landing/` are produced by `shoot.mjs` and *are* tracked, because
`screens/landing/storyChapters.ts` renders them.
