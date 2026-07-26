# Hosting and data

## What runs where

| Layer | Technology | Notes |
|-------|------------|--------|
| Frontend | React + Vite on **Vercel** | Env: `VITE_API_BASE_URL`, `VITE_PUBLIC_PDF_ORIGIN`, `VITE_USER_ID` only — **no Supabase keys in the browser** |
| Backend | **FastAPI** (Python) | MedData, Supp.AI, OpenFDA, GP PDFs, dm+d lookup |
| dm+d | Read-only **SQLite** (`dmd.sqlite` or sample fallback) | TRUD ingest or `scripts/build_sample_dmd.py` |
| App data | **Supabase Postgres** or local **`app.sqlite`** | Set `APP_DATABASE_URL` for Supabase; leave empty for SQLite |
| Identity (v1) | Header **`X-User-Id`** | Demo default `demo`; not production auth |

The React app is unchanged: localStorage fixtures + sync to `/medications`. Supabase is **backend-only** Postgres for cabinet, interactions, GP tokens, and API cache.

## Supabase setup (app Postgres + demo seed)

Full steps: [`../supabase/README.md`](../supabase/README.md).

1. Create a Supabase project; apply [`../supabase/migrations/`](../supabase/migrations/) (`supabase db push` or SQL editor).
2. Set backend `APP_DATABASE_URL` to the **transaction pooler** URI (port 6543, `sslmode=require`).
3. Seed demo user: `python backend/scripts/seed_demo_cabinet.py` (idempotent; uses [`demo_seed.py`](../backend/app/services/demo_seed.py)).
4. `/health` should report `"app_db_backend": "postgres"` and `"app_db_ok": true`.

RLS is enabled on all app tables with **no** public policies, so only the server Postgres connection is used.

Supabase **does not** run FastAPI. Deploy uvicorn on your laptop, a tunnel, or a Python PaaS (below).

## Hackathon / phone demo

**Vercel frontend + FastAPI** on your laptop (or LAN), with an HTTPS tunnel when the phone loads the HTTPS Vercel app.

See [deploy-vercel-phone-scan.md](deploy-vercel-phone-scan.md).

You can use SQLite locally (`APP_DATABASE_URL` unset) or Supabase for a shared demo database.

## Always-on cloud API

Deploy the **Python backend** to a PaaS, then point Vercel’s `VITE_API_BASE_URL` at that URL. Set `APP_DATABASE_URL` on the API service if using Supabase.

| Host | Fit | Notes |
|------|-----|--------|
| [Render](https://render.com) | Good | [backend/render.yaml](../backend/render.yaml) + [backend/Dockerfile](../backend/Dockerfile) |
| [Fly.io](https://fly.io) | Good | `fly launch` from `backend/` using the Dockerfile |
| [Railway](https://railway.app) | Good | Docker or `pip install -e .` + uvicorn |
| [Google Cloud Run](https://cloud.google.com/run) | Good | Container from `backend/Dockerfile` |

Set env vars from [backend/.env.example](../backend/.env.example). Include your Vercel origin in `CORS_ORIGINS` and set `PUBLIC_BASE_URL` to the public API URL.

**dm+d on cloud:** ship `data/dmd.sample.sqlite` in the image, or set `TRUD_API_KEY` + `TRUD_DMD_ITEM_ID` for startup sync. Large `dmd.sqlite` needs persistent disk or download on boot.

## Later (optional)

- **Supabase Auth** + JWT validation in FastAPI instead of `X-User-Id`
- Frontend reading Supabase directly (would replace dual localStorage model)

Do **not** move MedData/Supp.AI/PDF/dm+d logic into Edge Functions unless you rewrite in TypeScript.

## Smoke test

```bash
curl -s "https://YOUR-API/health" | jq '.status, .app_db_backend, .app_db_ok'
curl -s "https://YOUR-API/medications" -H 'X-User-Id: demo' | jq length
```

Then set Vercel env vars and redeploy the frontend.
