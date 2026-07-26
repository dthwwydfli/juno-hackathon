"""Keep tests on SQLite even when backend/.env sets APP_DATABASE_URL for local Supabase."""

import os
from pathlib import Path

_backend = Path(__file__).resolve().parent.parent
os.environ["APP_DATABASE_URL"] = ""
os.environ["APP_DB_PATH"] = str(_backend / "data" / "test_app.sqlite")
