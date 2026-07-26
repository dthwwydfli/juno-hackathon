#!/usr/bin/env python3
"""Pack the ingested dm+d database into a committable artifact for deploys.

`ingest_dmd.py` produces a ~53 MB `data/dmd.sqlite`, two thirds of which is AMPP rows
carrying no GTIN — dead weight for a barcode lookup. Dropping those, VACUUMing, and
gzipping gets the same 100k scannable packs down to ~4 MB, small enough to live in git
and ship inside the image. Render then serves the real dm+d on a cold start instead of
falling back to the 3-row sample, which is what made every scan 404.

Usage:  python scripts/build_slim_dmd.py [--source data/dmd.sqlite]
"""

from __future__ import annotations

import argparse
import gzip
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = BACKEND_ROOT / "data" / "dmd.sqlite"
DEFAULT_OUTPUT = BACKEND_ROOT / "data" / "dmd.slim.sqlite.gz"


def build_slim_db(source: Path, dest: Path) -> int:
    """Copy `source` minus its GTIN-less rows into `dest`. Returns rows kept."""
    src = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
    try:
        # .backup rather than a fresh CREATE so the schema and its three indexes come
        # across exactly as ingest_dmd.py wrote them.
        dst = sqlite3.connect(dest)
        try:
            src.backup(dst)
            dst.execute("DELETE FROM gtin_lookup WHERE gtin IS NULL OR gtin = ''")
            dst.commit()
            dst.execute("VACUUM")
            return dst.execute("SELECT count(*) FROM gtin_lookup").fetchone()[0]
        finally:
            dst.close()
    finally:
        src.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    ap.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = ap.parse_args()

    if not args.source.is_file():
        print(
            f"No dm+d database at {args.source}. Run scripts/ingest_dmd.py first.",
            file=sys.stderr,
        )
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        slim = Path(tmp) / "dmd.slim.sqlite"
        rows = build_slim_db(args.source, slim)
        with slim.open("rb") as f_in, gzip.open(args.output, "wb", compresslevel=9) as f_out:
            shutil.copyfileobj(f_in, f_out)
        uncompressed = slim.stat().st_size

    print(
        f"{args.output.relative_to(BACKEND_ROOT)}: {rows:,} GTINs, "
        f"{uncompressed / 1e6:.1f} MB uncompressed, "
        f"{args.output.stat().st_size / 1e6:.1f} MB gzipped"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
