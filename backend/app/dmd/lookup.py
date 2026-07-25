from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import settings


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
                    WHERE gtin = :code OR gtin = :padded
                    LIMIT 1
                    """
                ),
                {"code": code, "padded": code.zfill(14)},
            ).mappings().first()
        elif code_type == "pack":
            row = conn.execute(
                text(
                    """
                    SELECT gtin, ampp_code, display_name, form, strength, vtm_name
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
                    SELECT gtin, ampp_code, display_name, form, strength, vtm_name
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
