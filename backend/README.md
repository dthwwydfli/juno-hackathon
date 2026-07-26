# Juno medication safety — backend

FastAPI backend for NHS dm+d barcode lookup, personal medicine cabinet, interaction checks (MedData + Supp.AI + OpenFDA), GP PDF/QR sharing.

## Quick start

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python scripts/build_sample_dmd.py
cp .env.example .env   # add MEDDATA_API_KEY (optional OPENFDA_API_KEY)
# With TRUD_API_KEY + TRUD_DMD_ITEM_ID set, run `python scripts/ingest_dmd.py --download`
# or restart the API — it auto-syncs from TRUD when the dm+d DB is still the sample file.
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir .
```

Open:

- API docs: http://localhost:8000/docs
- Dev barcode scanner: http://localhost:8000/dev/scan
- Dev GP QR: http://localhost:8000/dev/qr

## Environment variables

See [`.env.example`](.env.example).

| Variable | Purpose |
|----------|---------|
| `DMD_DB_PATH` | dm+d SQLite (from TRUD ingest or sample builder) |
| `APP_DB_PATH` | Application SQLite |
| `APP_DATABASE_URL` | Optional Supabase Postgres (transaction pooler). Empty = use `APP_DB_PATH` SQLite |
| `TRUD_API_KEY` / `TRUD_DMD_ITEM_ID` | Automated dm+d download |
| `OPENFDA_API_KEY` | Optional higher rate limits for FDA label excerpts |
| `MEDDATA_API_KEY` | [MedData](https://meddata.anthesia.io) interaction checks (`X-API-Key` header). Free tier: `POST /api/v1/signup` with email |
| `MEDDATA_BASE_URL` | Default `https://meddata.anthesia.io` |
| `PUBLIC_BASE_URL` | Base URL embedded in GP QR links |
| `GP_TOKEN_TTL_HOURS` | Share link lifetime |

Interaction checks use **MedData first** (ingredient names parsed from scanned dm+d `display_name` strings). **[Supp.AI](https://supp.ai/docs/api)** runs only when MedData returns no match for that pair (no API key; Semantic Scholar dataset license).

## NHS dm+d (TRUD)

1. Register at [TRUD](https://isd.digital.nhs.uk/trud/) and subscribe to **dm+d**.
2. Ingest a release zip:

```bash
python scripts/ingest_dmd.py --zip /path/to/dmd_release.zip
```

Or download with API credentials:

```bash
export TRUD_API_KEY=...
export TRUD_DMD_ITEM_ID=...
python scripts/ingest_dmd.py --download
```

### Shipping dm+d to a deploy

`data/dmd.sqlite` is gitignored and far too big to commit, so deployed images carry a
packed copy instead. After any ingest, rebuild it:

```bash
python scripts/build_slim_dmd.py   # → data/dmd.slim.sqlite.gz (~4 MB, 100k GTINs)
```

Commit the `.gz`. The Dockerfile copies it in and `scripts/docker_entrypoint.sh` unpacks
it to `DMD_DB_PATH` on boot. Skip this and the container falls back to the 3-row sample —
`/health` reports `"dmd_ready": false` and **every barcode scan 404s**. Rows with no GTIN
are dropped (they can never match a scan), which is what takes 53 MB down to 4 MB.

For demos without TRUD:

```bash
python scripts/build_sample_dmd.py
python scripts/seed_demo_cabinet.py   # mock meds for GP QR demo (user: demo)
python scripts/seed_meddata_demo_cabinet.py   # optional: backend-only MedData demo cabinet (destructive for demo user in SQLite)
```

## GP mock QR demo

1. Seed mock medicines (optional if you use demo-share):

```bash
python scripts/seed_demo_cabinet.py
```

2. Start the API and open the dev QR page using a URL your phone can reach (LAN IP or tunnel), e.g. `http://192.168.1.x:8000/dev/qr`.

3. Click **Generate mock demo QR** — calls `POST /gp/demo-share` (seeds demo data + creates a share token).

4. Scan the QR; the phone opens the clinician PDF (`GET /gp/summary/{token}.pdf`) with active medicines (dose, schedule, start date), archived medicines, interaction highlights, and disclaimers.

The QR encodes `{page-origin}/gp/summary/{token}.pdf` (not `PUBLIC_BASE_URL`), so use the same host on your laptop and phone. For remote demos, open `/dev/qr` via ngrok and set `PUBLIC_BASE_URL` to that URL if other clients need absolute links.

**GP share token + PDF**

```bash
curl -s -X POST http://localhost:8000/gp/demo-share -H "X-User-Id: demo" | jq

curl -s -X POST http://localhost:8000/gp/share-token \
  -H "Content-Type: application/json" \
  -H "X-User-Id: demo" \
  -d '{"patient_label": "Demo Patient"}' | jq

# Open pdf_url from response in browser or:
curl -o summary.pdf "http://localhost:8000/gp/summary/<token>.pdf"
```

Default user header: `X-User-Id: demo`.

**Lookup barcode**

```bash
curl -s "http://localhost:8000/lookup/barcode?code=5012345678901" | jq
```

**Add medicine**

```bash
curl -s -X POST http://localhost:8000/medications \
  -H "Content-Type: application/json" \
  -H "X-User-Id: demo" \
  -d '{
    "display_name": "Paracetamol 500mg tablets (sample)",
    "category": "otc",
    "dosage": "2 tablets",
    "schedule": {"times": ["08:00", "20:00"]},
    "gtin": "5012345678901"
  }' | jq
```

**Check interactions** (needs ≥2 active meds; MedData primary, Supp.AI gap-fill, pair-relevant OpenFDA excerpts)

Smoke-test six scanned-name pairs against live APIs:

```bash
python scripts/smoke_interactions.py
```

```bash
curl -s -X POST http://localhost:8000/interactions/check \
  -H "Content-Type: application/json" \
  -H "X-User-Id: demo" \
  -d '{}' | jq
```

**Interaction check troubleshooting**

1. `GET http://localhost:8000/health` — expect `meddata_configured: true`.
2. If `sources_status.meddata` is `unavailable` and `meddata_detail` is `403 Forbidden`, rotate or fix `MEDDATA_API_KEY` in `.env` (free signup: MedData docs).
3. After a 403 or quota hit, MedData calls are blocked for several hours. Clear the cooldown locally:

```bash
cd backend && source .venv/bin/activate
python scripts/clear_meddata_block.py
```

Then restart uvicorn and retry the curl check above.

**Interaction detail**

```bash
curl -s http://localhost:8000/interactions/1 -H "X-User-Id: demo" | jq
```

## Supabase (app Postgres, frontend unchanged)

FastAPI stores app data in **Supabase Postgres** when `APP_DATABASE_URL` is set; otherwise **`data/app.sqlite`**. The Vite app still uses localStorage + REST; no Supabase client in the frontend.

1. Apply migrations: see [`../supabase/README.md`](../supabase/README.md).
2. Set `APP_DATABASE_URL` in `.env` (pooler URI from Supabase dashboard).
3. Seed demo cabinet: `python scripts/seed_demo_cabinet.py`
4. Check: `curl -s http://localhost:8000/health | jq '.app_db_backend, .app_db_ok'`

Demo medicines for `X-User-Id: demo` come from [`app/services/demo_seed.py`](app/services/demo_seed.py). Frontend fixture data in `frontend/src/data/fixtures.ts` is separate and unchanged.

## Cloud API (Python PaaS)

Supabase hosts **Postgres only**, not uvicorn. For an always-on API, deploy **Python** to Render, Fly.io, Railway, or Cloud Run using the included container:

```bash
cd backend
docker build -t juno-meds-api .
docker run --rm -p 8000:8000 -e CORS_ORIGINS=https://your-app.vercel.app juno-meds-api
```

On [Render](https://render.com), set **Root Directory** to `backend` and use [`render.yaml`](render.yaml), or connect the Dockerfile directly. Set `PUBLIC_BASE_URL`, `CORS_ORIGINS`, `MEDDATA_API_KEY`, and optionally `APP_DATABASE_URL` in the service env.

See [`../docs/hosting-and-data.md`](../docs/hosting-and-data.md) for hackathon vs cloud paths and when Supabase Postgres/Auth might be added later.

## Tests

```bash
pytest
```

## Frontend integration

- Send `X-User-Id` on cabinet, interaction, and GP routes.
- CORS origins configured via `CORS_ORIGINS` (includes `http://localhost:5173`).
- **Vercel + phone barcode scan:** [`../docs/deploy-vercel-phone-scan.md`](../docs/deploy-vercel-phone-scan.md) — bind API with `./scripts/run_lan_api.sh` or uvicorn `--host 0.0.0.0`.
- Product overview: [`../README.md`](../README.md).
- Vite app: [`../frontend/`](../frontend/).

**GP QR (future app):**

- Patient: `POST /gp/share-token` with the authenticated user id; show a QR encoding `{publicOrigin}/gp/summary/{token}.pdf` (use production `PUBLIC_BASE_URL`, not localhost).
- Clinician: scan opens the PDF; no `X-User-Id` required. Links expire after `GP_TOKEN_TTL_HOURS`.
- Hackathon mock path: `POST /gp/demo-share` with `X-User-Id: demo` only.
