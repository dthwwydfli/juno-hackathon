#!/bin/sh
set -e

mkdir -p "$(dirname "$DMD_DB_PATH")" "$(dirname "$APP_DB_PATH")"

# Render's free plan has no persistent disk, so this runs on every cold start. Unpacking
# ~21 MB takes well under a second; the sample is only a last resort, and a deploy running
# on it answers every barcode lookup with a 404.
if [ ! -f "$DMD_DB_PATH" ]; then
  if [ -f /app/data/dmd.slim.sqlite.gz ]; then
    echo "Unpacking dm+d database to $DMD_DB_PATH"
    python - "$DMD_DB_PATH" <<'PY'
import gzip
import shutil
import sqlite3
import sys
from pathlib import Path

dest = Path(sys.argv[1])
tmp = dest.with_suffix(dest.suffix + ".partial")
with gzip.open("/app/data/dmd.slim.sqlite.gz", "rb") as f_in, tmp.open("wb") as f_out:
    shutil.copyfileobj(f_in, f_out)
# Move only once the file is whole, so a killed boot cannot leave a truncated database
# behind that later starts would happily reuse.
tmp.replace(dest)
with sqlite3.connect(f"file:{dest}?mode=ro", uri=True) as conn:
    print(f"dm+d ready: {conn.execute('SELECT count(*) FROM gtin_lookup').fetchone()[0]:,} GTINs")
PY
  elif [ -f /app/data/dmd.sample.sqlite ]; then
    echo "WARNING: dmd.slim.sqlite.gz missing — falling back to the 3-row sample; barcode lookups will 404."
    cp /app/data/dmd.sample.sqlite "$DMD_DB_PATH"
  fi
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
