# juno-hackathon

## Frontend

```bash
cd frontend && cp .env.example .env && npm install && npm run dev
```

Open the app at **http://localhost:5173** (API defaults to **http://localhost:8000** in `frontend/.env`).

Phone / LAN testing for QR scans is optional later — see comments in `frontend/.env.example`.

**Vercel + phone barcode scanning:** [docs/deploy-vercel-phone-scan.md](docs/deploy-vercel-phone-scan.md)

**Hosting choices (Supabase app DB + FastAPI):** [docs/hosting-and-data.md](docs/hosting-and-data.md)

**Vercel deploy:** set `VITE_API_BASE_URL`, `VITE_PUBLIC_PDF_ORIGIN`, and `VITE_USER_ID` in the project env vars, then redeploy — otherwise the built app defaults to `http://localhost:8000` and API calls fail on phones.

Add `MEDDATA_API_KEY` in backend `.env` for faster interaction checks (see [backend/README.md](backend/README.md)).

### Verify API wiring

**Health:**

```text
http://localhost:8000/health
```

Expect `status: ok`, `meddata_configured: true`, `app_db_ok: true`.

**MedData + Supp.AI smoke (laptop, live APIs):**

```bash
cd backend && source .venv/bin/activate
python scripts/smoke_interactions.py
```

**Full interaction check for demo user (after backend is running):**

```bash
curl -s -X POST http://localhost:8000/interactions/check \
  -H 'X-User-Id: demo' -H 'Content-Type: application/json' -d '{}'
```

The app runs interaction checks **only through the Python backend** (`POST /interactions/check`); Home and Interactions share the same results (no client-side demo fallback). The API no longer auto-replaces the demo user's medicines when MedData returns no hits — for a backend-only MedData demo cabinet, run `python scripts/seed_meddata_demo_cabinet.py` from `backend/` (does not change the phone's localStorage).
