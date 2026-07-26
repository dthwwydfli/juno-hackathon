# Supabase (app Postgres)

Stores FastAPI **app** data (medications, interactions, GP tokens, API cache). dm+d stays in backend SQLite.

The React app does **not** connect to Supabase; it keeps using the REST API and `X-User-Id: demo`.

## Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and link:

   ```bash
   cd /path/to/juno-hackathon
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   Or run the SQL in [`migrations/20260726100000_app_schema.sql`](migrations/20260726100000_app_schema.sql) from the SQL editor.

3. Copy the **transaction pooler** connection string (port **6543**, `sslmode=require`) into backend `.env`:

   ```bash
   APP_DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```

   Dashboard: **Project Settings → Database → Connection string → URI (Transaction pooler)**.

4. Seed demo cabinet (idempotent):

   ```bash
   cd backend
   source .venv/bin/activate
   python scripts/bootstrap_supabase.py
   ```

   Or, if tables already exist: `python scripts/seed_demo_cabinet.py`

5. Start API and verify:

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir .
   curl -s http://localhost:8000/health | jq '.app_db_backend, .app_db_ok'
   curl -s http://localhost:8000/medications -H 'X-User-Id: demo' | jq length
   curl -s -X POST http://localhost:8000/gp/demo-share -H 'X-User-Id: demo' | jq
   ```

## RLS

All tables have RLS enabled with **no** policies for `anon` / `authenticated`, so the public Data API cannot read app data. Only the server-side Postgres connection (FastAPI) is used.

## Local SQLite fallback

Leave `APP_DATABASE_URL` empty to use `backend/data/app.sqlite` (default for tests and offline dev).

## Local Postgres (fastest dev without cloud)

If Supabase CLI conflicts with another local project, use Docker Postgres + bootstrap:

```bash
docker run -d --name juno_app_pg -e POSTGRES_PASSWORD=postgres -p 54332:5432 postgres:15-alpine
# In backend/.env:
# APP_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54332/postgres
cd backend && source .venv/bin/activate && python scripts/bootstrap_supabase.py
```

Uses the same migration SQL as Supabase; `/health` reports `app_db_backend: postgres`. Swap the URL for your **Supabase pooler** URI when deploying.
