#!/usr/bin/env python3
"""Apply supabase migrations and seed demo data when APP_DATABASE_URL is set."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND = ROOT / "backend"
MIGRATION = ROOT / "supabase" / "migrations" / "20260726100000_app_schema.sql"

sys.path.insert(0, str(BACKEND))


def main() -> int:
    from app.config import settings

    url = settings.app_database_url.strip()
    if not url:
        print(
            "Set APP_DATABASE_URL in backend/.env (Supabase pooler or local Postgres).",
            file=sys.stderr,
        )
        return 1

    if not MIGRATION.is_file():
        print(f"Missing migration: {MIGRATION}", file=sys.stderr)
        return 1

    sql = MIGRATION.read_text(encoding="utf-8")

    import psycopg

    print(f"Connecting to Postgres ({settings.uses_postgres_app_db})…")
    with psycopg.connect(url) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = 'medications'"
            )
            if cur.fetchone() is None:
                cur.execute(sql)
                print("Migration applied.")
            else:
                print("Migration skipped (medications table already exists).")

    # Import after migration; engine uses psycopg via postgresql+psycopg URL.
    from app.db.models import SessionLocal, init_app_db
    from app.services.demo_seed import DEMO_USER_ID, seed_demo_cabinet

    init_app_db()
    db = SessionLocal()
    try:
        seed_demo_cabinet(db, user_id=DEMO_USER_ID)
        print(f"Demo cabinet seeded for X-User-Id: {DEMO_USER_ID}")
    finally:
        db.close()

    from app.db.models import app_db_backend, app_db_ok

    print(f"app_db_backend={app_db_backend()} app_db_ok={app_db_ok()}")
    return 0 if app_db_ok() else 1


if __name__ == "__main__":
    raise SystemExit(main())
