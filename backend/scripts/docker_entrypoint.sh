#!/bin/sh
set -e

mkdir -p "$(dirname "$DMD_DB_PATH")" "$(dirname "$APP_DB_PATH")"

if [ ! -f "$DMD_DB_PATH" ] && [ -f /app/data/dmd.sample.sqlite ]; then
  cp /app/data/dmd.sample.sqlite "$DMD_DB_PATH"
fi

if [ "${SEED_DEMO_ON_START:-}" = "1" ]; then
  python - <<'PY'
from app.db.models import SessionLocal, init_app_db
from app.services.demo_seed import DEMO_USER_ID, seed_demo_cabinet

init_app_db()
db = SessionLocal()
try:
    seed_demo_cabinet(db, user_id=DEMO_USER_ID)
finally:
    db.close()
PY
fi

exec "$@"
