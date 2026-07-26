"""Tests for UTC datetime helpers and Postgres-aware timestamp handling."""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from app.db.models import ApiCacheEntry, SessionLocal
from app.routers.gp import _validate_token
from app.services import api_cache
from app.time_util import as_utc_aware, utc_now


def test_as_utc_aware_naive_treated_as_utc():
    naive = datetime(2026, 1, 15, 12, 0, 0)
    aware = as_utc_aware(naive)
    assert aware.tzinfo == timezone.utc
    assert aware.hour == 12


def test_validate_token_with_timezone_aware_expires_at():
    row = MagicMock()
    row.expires_at = utc_now() + timedelta(hours=2)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = row
    assert _validate_token(db, "valid-token") is row


def test_cache_ttl_with_timezone_aware_fetched_at():
    fetched_at = utc_now() - timedelta(hours=1)
    assert utc_now() - as_utc_aware(fetched_at) <= timedelta(hours=24)


def test_read_cache_hit_with_aware_fetched_at_in_db():
    key = "test-aware-cache-key"
    provider = "meddata"
    with SessionLocal() as db:
        db.query(ApiCacheEntry).filter(ApiCacheEntry.cache_key == key).delete()
        db.commit()

    api_cache.write_cache(provider, key, {"ok": True})

    with SessionLocal() as db:
        row = (
            db.query(ApiCacheEntry)
            .filter(ApiCacheEntry.cache_key == key, ApiCacheEntry.provider == provider)
            .one()
        )
        row.fetched_at = utc_now() - timedelta(hours=1)
        db.commit()

    hit = api_cache.read_cache(provider, key, ttl_hours=24)
    assert hit == {"ok": True}

    with SessionLocal() as db:
        db.query(ApiCacheEntry).filter(ApiCacheEntry.cache_key == key).delete()
        db.commit()
