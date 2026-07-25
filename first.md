# Frontend ↔ backend integration contract

Read this before wiring the Vite app in [`frontend/`](frontend/) to the FastAPI API in [`backend/`](backend/). **Do not change screen layout, CSS tokens, or copy** — only connect data and APIs per [`frontend/BUILD_CONTRACT.md`](frontend/BUILD_CONTRACT.md).

## Goals

- **Barcode:** Laptop/phone camera scans GTIN (ZXing); backend resolves NHS dm+d via `POST /lookup/barcode`; form fields pre-fill on Add (scan + optional manual GTIN).
- **Interactions:** `POST /interactions/check` on the Python backend (MedData by default via `meddata_only: true`); map responses to existing `Interaction` UI (single amber, no severity grades). The app does **not** replace the local medication list from the server.
- **GP share:** Sync local cabinet to backend, `POST /gp/share-token`, QR encodes `{API origin}/gp/summary/{token}.pdf` (phone opens backend PDF, same as [`backend/app/static/dev/qr.html`](backend/app/static/dev/qr.html)).

## Out of scope

- Production auth (use header `X-User-Id`, default `demo`).
- Replacing localStorage with a server-only cabinet (local store remains UI source of truth; backend sync for GP and optional interaction fallback).
- Visual redesign, new routes, or edits to `App.tsx` / global CSS.

## Dev topology

| Service | URL | Notes |
|---------|-----|--------|
| Backend | `http://localhost:8000` (LAN: `http://<IP>:8000`) | `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir .` from `backend/` |
| Frontend | `http://localhost:5173` | `npm run dev` from `frontend/` |
| Phone (QR + PDF) | `http://<LAN-IP>:8000` | Set `PUBLIC_BASE_URL` and `VITE_PUBLIC_PDF_ORIGIN` to LAN IP, not `localhost` |

API docs: `http://localhost:8000/docs`  
Dev barcode page (reference): `http://localhost:8000/dev/scan`  
Dev GP QR (reference): `http://localhost:8000/dev/qr`

## Environment variables

### Backend (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `MEDDATA_API_KEY` | MedData interaction API (also used by proxy route) |
| `PUBLIC_BASE_URL` | Absolute PDF URLs in share-token responses (`http://192.168.x.x:8000` for phone) |
| `CORS_ORIGINS` | Include `http://localhost:5173` and LAN frontend origin if used |

### Frontend (`frontend/.env.local`, copy from `.env.example`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Backend root, e.g. `http://localhost:8000` |
| `VITE_USER_ID` | `X-User-Id` header (default `demo`) |
| `VITE_PUBLIC_PDF_ORIGIN` | Host encoded in GP QR (defaults to `VITE_API_BASE_URL`; use LAN IP for phone scan) |

MedData (and optional Supp.AI on the server when `meddata_only` is false) runs in the Python backend so the API key stays server-side. A legacy proxy route exists for ad-hoc checks; the app uses `POST /interactions/check` only.

## API surface used by the app

### Barcode lookup

```http
POST /lookup/barcode
Content-Type: application/json

{"code": "5012345678901", "code_type": "gtin"}
```

Response fields used: `display_name`, `vtm_name`, `strength`, `form`, `gtin`, `dmd_codes`.

Mapping lives in `frontend/src/lib/dmd-map.ts`.

### Medications (GP sync)

```http
GET /medications?status=active|archived|all
POST /medications
PATCH /medications/{id}  {"archive": true}
Header: X-User-Id: demo
```

Category map: `NHS → nhs_prescription`, `OTC → otc`, `Private → online`.

### Interactions

```http
POST /interactions/check
Content-Type: application/json

{"meddata_only": true}
GET /interactions/{interaction_id}
Header: X-User-Id: demo
```

Frontend syncs the local cabinet to `/medications` before checking. Empty results mean no MedData signal for the current meds — not a reason to swap the demo cabinet (use `python scripts/seed_meddata_demo_cabinet.py` only when you intentionally want backend-only MedData demo data).

### GP share

```http
POST /gp/share-token
{"patient_label": "Jordan Ellis"}
Header: X-User-Id: demo
```

QR text: `${VITE_PUBLIC_PDF_ORIGIN}/gp/summary/${token}.pdf` (not the fake app URL).

Quick demo without sync: `POST /gp/demo-share` (demo user only).

## Data flow summary

```mermaid
flowchart LR
  Add[Add scan/manual] --> Lookup[POST lookup/barcode]
  IX[interactions-live.ts] --> SyncIx[sync-cabinet.ts]
  SyncIx --> Meds[/medications]
  IX --> PyIX[POST interactions/check]
  Share[Share screen] --> Sync[sync-cabinet.ts]
  Sync --> Meds
  Share --> Gp[POST gp/share-token]
  Gp --> Pdf[GET gp/summary/token.pdf]
```

**Dual state:** medicines display from **localStorage**; sync before interaction checks and GP share pushes to **app.sqlite** so the backend matches the app. The server never overwrites the UI cabinet.

## Verification checklist

1. **dm+d sample DB:** `python backend/scripts/build_sample_dmd.py`
2. **Barcode:** `curl -s -X POST http://localhost:8000/lookup/barcode -H 'Content-Type: application/json' -d '{"code":"5012345678901","code_type":"gtin"}'`
3. **App:** Add → Camera → scan or Manual → GTIN lookup → save → appears on Home
4. **Interactions:** ≥2 active meds → Interactions list; Read more; adding a conflicting med shows Warning sheet
5. **MedData smoke (backend):** `python backend/scripts/smoke_interactions.py`
6. **GP QR:** Set LAN URLs, generate QR in Share, scan on phone → PDF opens with synced meds
7. **Build:** `cd frontend && npm run build`; `cd backend && pytest`

## Interaction UI rules (legal/product)

- One label: **Potential interaction** — never show High/Moderate severity on interaction surfaces.
- MedData severity is used internally only; not rendered.
- Keep `<GpNote/>` and disclaimer copy on interaction/GP surfaces.
