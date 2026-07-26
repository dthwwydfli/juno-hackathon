from pathlib import Path

from sqlalchemy import bindparam, create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import settings

#: The zero-padded widths a GTIN is legitimately written at (GTIN-8/12/13/14).
GTIN_WIDTHS = (8, 12, 13, 14)


def get_dmd_engine():
    path = Path(settings.dmd_db_path)
    if not path.exists():
        sample = Path(settings.dmd_db_path).parent / "dmd.sample.sqlite"
        if sample.exists():
            path = sample
        else:
            raise FileNotFoundError(
                f"dm+d database not found at {settings.dmd_db_path}. "
                "Run scripts/build_sample_dmd.py or scripts/ingest_dmd.py."
            )
    return create_engine(
        f"sqlite:///{path}",
        connect_args={"check_same_thread": False},
    )


DmdSessionLocal = sessionmaker(autocommit=False, autoflush=False)


def gtin_variants(code: str) -> list[str]:
    """Every zero-padding of `code` that means the same GTIN.

    Two GTINs are the same product when their 14-digit zero-padded forms match, but dm+d
    stores them unpadded far more often than not (88k rows at 13 digits, 12k at 14). A
    pack's linear EAN-13 therefore hits, while the GTIN-14 read off the same pack's FMD
    DataMatrix missed — 404, which the scanner shows as an endless scan/lookup loop.
    Comparing on the padded form directly would work but cannot use idx_gtin, so expand
    to the handful of literal spellings and keep the index lookup.
    """
    if not code.isdigit():
        return [code]
    core = code.lstrip("0")
    if not core:
        return [code]
    variants = {code}
    variants.update(core.zfill(w) for w in GTIN_WIDTHS if len(core) <= w)
    return sorted(variants)


def lookup_by_code(code: str, code_type: str) -> dict | None:
    code = code.strip()
    engine = get_dmd_engine()
    DmdSessionLocal.configure(bind=engine)
    with engine.connect() as conn:
        if code_type == "gtin":
            row = conn.execute(
                text(
                    """
                    SELECT gtin, ampp_code, vmp_code, display_name, form, strength, vtm_name
                    FROM gtin_lookup
                    WHERE gtin IN :codes
                    LIMIT 1
                    """
                ).bindparams(bindparam("codes", expanding=True)),
                {"codes": gtin_variants(code)},
            ).mappings().first()
        elif code_type == "pack":
            row = conn.execute(
                text(
                    """
                    SELECT gtin, ampp_code, vmp_code, display_name, form, strength, vtm_name
                    FROM gtin_lookup
                    WHERE ampp_code = :code
                    LIMIT 1
                    """
                ),
                {"code": code},
            ).mappings().first()
        else:
            row = conn.execute(
                text(
                    """
                    SELECT gtin, ampp_code, vmp_code, display_name, form, strength, vtm_name
                    FROM gtin_lookup
                    WHERE vmp_code = :code OR ampp_code = :code
                    LIMIT 1
                    """
                ),
                {"code": code},
            ).mappings().first()
        if not row:
            return None
        return {
            "found": True,
            "display_name": row["display_name"],
            "gtin": row["gtin"],
            "dmd_codes": {
                "ampp": row["ampp_code"],
                "vmp": row["vmp_code"],
            },
            "form": row["form"],
            "strength": row["strength"],
            "vtm_name": row["vtm_name"],
        }
