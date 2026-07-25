#!/usr/bin/env python3
"""Seed mock medicines and an interaction highlight for the demo user."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.models import SessionLocal, init_app_db
from app.services.demo_seed import DEMO_USER_ID, seed_demo_cabinet


def main() -> None:
    init_app_db()
    db = SessionLocal()
    try:
        seed_demo_cabinet(db, user_id=DEMO_USER_ID)
        print(f"Demo cabinet ready for X-User-Id: {DEMO_USER_ID}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
