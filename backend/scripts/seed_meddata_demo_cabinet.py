#!/usr/bin/env python3
"""Replace demo user's backend cabinet with MedData-verified meds (manual demo prep only)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.models import SessionLocal, init_app_db
from app.services.demo_seed import DEMO_USER_ID, seed_meddata_demo_cabinet


def main() -> None:
    init_app_db()
    db = SessionLocal()
    try:
        seed_meddata_demo_cabinet(db, user_id=DEMO_USER_ID)
        print(f"MedData demo cabinet ready for X-User-Id: {DEMO_USER_ID}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
