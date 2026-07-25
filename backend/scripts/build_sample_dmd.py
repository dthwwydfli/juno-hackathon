#!/usr/bin/env python3
"""Build a small dm+d SQLite for demos (no TRUD zip required)."""

import argparse
import sqlite3
from pathlib import Path

SAMPLE_ROWS = [
    {
        "gtin": "5012345678901",
        "ampp_code": "123456789012345",
        "vmp_code": "123456789012346",
        "display_name": "Paracetamol 500mg tablets (sample)",
        "form": "Tablet",
        "strength": "500mg",
        "vtm_name": "Paracetamol",
    },
    {
        "gtin": "5012345678902",
        "ampp_code": "123456789012347",
        "vmp_code": "123456789012348",
        "display_name": "Ibuprofen 200mg tablets (sample)",
        "form": "Tablet",
        "strength": "200mg",
        "vtm_name": "Ibuprofen",
    },
    {
        "gtin": "5057997022510",
        "ampp_code": "338112008",
        "vmp_code": "318591005",
        "display_name": "Aspirin 300mg tablets (demo GTIN)",
        "form": "Tablet",
        "strength": "300mg",
        "vtm_name": "Aspirin",
    },
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS gtin_lookup (
    gtin TEXT NOT NULL,
    ampp_code TEXT NOT NULL,
    vmp_code TEXT,
    display_name TEXT NOT NULL,
    form TEXT,
    strength TEXT,
    vtm_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_gtin ON gtin_lookup(gtin);
CREATE INDEX IF NOT EXISTS idx_ampp ON gtin_lookup(ampp_code);
CREATE INDEX IF NOT EXISTS idx_vmp ON gtin_lookup(vmp_code);
"""


def build(out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()
    conn = sqlite3.connect(out_path)
    conn.executescript(SCHEMA)
    for row in SAMPLE_ROWS:
        conn.execute(
            """
            INSERT INTO gtin_lookup
            (gtin, ampp_code, vmp_code, display_name, form, strength, vtm_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["gtin"],
                row["ampp_code"],
                row["vmp_code"],
                row["display_name"],
                row["form"],
                row["strength"],
                row["vtm_name"],
            ),
        )
    conn.commit()
    conn.close()
    print(f"Wrote {out_path} ({len(SAMPLE_ROWS)} rows)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "data" / "dmd.sample.sqlite",
    )
    args = parser.parse_args()
    build(args.out)
    default = Path(__file__).resolve().parent.parent / "data" / "dmd.sqlite"
    if not default.exists():
        build(default)
        print(f"Also created {default}")


if __name__ == "__main__":
    main()
