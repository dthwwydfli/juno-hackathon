import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db.models import init_app_db
from app.dmd.sync import SAMPLE_DB_ROW_THRESHOLD, gtin_lookup_count, sync_dmd_from_trud
from app.routers import gp, health, interactions, lookup, medications, proxy

logger = logging.getLogger(__name__)
_STATIC = Path(__file__).resolve().parent / "static"


def _maybe_sync_dmd_on_startup() -> None:
    item_id = settings.trud_dmd_item_id.strip()
    api_key = settings.trud_api_key.strip()
    if not item_id or not api_key:
        return

    db_path = Path(settings.dmd_db_path)
    count = gtin_lookup_count(db_path)
    if count > SAMPLE_DB_ROW_THRESHOLD:
        return

    logger.info(
        "dm+d database has %s rows (sample threshold %s); syncing from TRUD item %s…",
        count,
        SAMPLE_DB_ROW_THRESHOLD,
        item_id,
    )
    try:
        n = sync_dmd_from_trud(db_path, item_id, api_key)
        logger.info("dm+d sync complete: %s GTIN rows → %s", n, db_path)
    except Exception as e:
        logger.warning("dm+d TRUD sync failed (keeping existing database): %s", e)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _maybe_sync_dmd_on_startup()
    yield


def create_app() -> FastAPI:
    init_app_db()
    app = FastAPI(
        title="Juno Medication Safety API",
        version="0.1.0",
        description="Hackathon backend for dm+d lookup, interactions, and GP PDF.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(lookup.router)
    app.include_router(medications.router)
    app.include_router(interactions.router)
    app.include_router(gp.router)
    app.include_router(proxy.router)
    if _STATIC.is_dir():
        app.mount("/static", StaticFiles(directory=_STATIC), name="static")

    @app.get("/dev/scan", response_class=HTMLResponse)
    def dev_scan():
        path = _STATIC / "dev" / "scan.html"
        return HTMLResponse(path.read_text(encoding="utf-8"))

    @app.get("/dev/qr", response_class=HTMLResponse)
    def dev_qr():
        path = _STATIC / "dev" / "qr.html"
        return HTMLResponse(path.read_text(encoding="utf-8"))

    return app


app = create_app()
