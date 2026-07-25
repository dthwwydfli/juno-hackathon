#!/usr/bin/env python3
"""
Ingest NHS dm+d release (TRUD zip) into SQLite for barcode lookup.

Usage:
  python scripts/ingest_dmd.py --zip /path/to/dmd_*.zip
  python scripts/ingest_dmd.py --download  # TRUD_* in backend/.env or environment

Expects XML files inside the zip (common TRUD layout):
  f_gtin*.xml, f_ampp*.xml, f_vmp*.xml, f_vtm*.xml
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Allow `python scripts/ingest_dmd.py` from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.dmd.sync import ingest_zip, sync_dmd_from_trud  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", type=Path, help="Path to dm+d TRUD zip")
    parser.add_argument("--download", action="store_true")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "data" / "dmd.sqlite",
    )
    args = parser.parse_args()

    if args.download:
        from app.config import settings

        item_id = (
            os.environ.get("TRUD_DMD_ITEM_ID") or settings.trud_dmd_item_id or ""
        ).strip()
        api_key = (
            os.environ.get("TRUD_API_KEY") or settings.trud_api_key or ""
        ).strip()
        if not item_id or not api_key:
            raise SystemExit(
                "Set TRUD_DMD_ITEM_ID and TRUD_API_KEY in backend/.env or environment"
            )
        try:
            n = sync_dmd_from_trud(args.out, item_id, api_key)
        except ValueError as e:
            raise SystemExit(str(e)) from e
    elif args.zip:
        n = ingest_zip(args.zip, args.out)
    else:
        parser.error("Provide --zip or --download")

    print(f"Ingested {n} GTIN rows → {args.out}")


if __name__ == "__main__":
    main()
