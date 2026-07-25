from pathlib import Path

from fastapi import APIRouter

from app.config import settings
from app.dmd.sync import SAMPLE_DB_ROW_THRESHOLD, gtin_lookup_count

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    db_path = Path(settings.dmd_db_path)
    count = gtin_lookup_count(db_path)
    trud_configured = bool(
        settings.trud_api_key.strip() and settings.trud_dmd_item_id.strip()
    )
    app_db_path = Path(settings.app_db_path)
    return {
        "status": "ok",
        "dmd_gtin_count": count,
        "dmd_ready": count > SAMPLE_DB_ROW_THRESHOLD,
        "trud_configured": trud_configured,
        "meddata_configured": bool(settings.meddata_api_key.strip()),
        "app_db_ok": app_db_path.is_file(),
    }
