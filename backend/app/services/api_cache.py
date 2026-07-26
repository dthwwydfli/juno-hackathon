"""Persistent cache + circuit breaker for third-party interaction APIs.

MedData is metered (250 requests/month on the current plan), so every avoidable
call is a real cost. A check on an unchanged cabinet must not touch the network.
"""

from __future__ import annotations

import hashlib
import json
from datetime import timedelta
from typing import Any

from app.db.models import ApiCacheEntry, ProviderState, SessionLocal
from app.time_util import as_utc_aware, utc_now


def fingerprint(provider: str, parts: list[str]) -> str:
    raw = "|".join([provider, *sorted(p.strip().lower() for p in parts)])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def read_cache(provider: str, key: str, ttl_hours: int) -> Any | None:
    if ttl_hours <= 0:
        return None
    with SessionLocal() as db:
        row = (
            db.query(ApiCacheEntry)
            .filter(ApiCacheEntry.cache_key == key, ApiCacheEntry.provider == provider)
            .first()
        )
        if not row:
            return None
        if utc_now() - as_utc_aware(row.fetched_at) > timedelta(hours=ttl_hours):
            db.delete(row)
            db.commit()
            return None
        try:
            return json.loads(row.payload)
        except json.JSONDecodeError:
            return None


def write_cache(provider: str, key: str, payload: Any) -> None:
    """Only ever called with a successful response; errors are never cached."""
    with SessionLocal() as db:
        row = db.query(ApiCacheEntry).filter(ApiCacheEntry.cache_key == key).first()
        if row:
            row.payload = json.dumps(payload)
            row.fetched_at = utc_now()
        else:
            db.add(
                ApiCacheEntry(
                    provider=provider,
                    cache_key=key,
                    payload=json.dumps(payload),
                    fetched_at=utc_now(),
                )
            )
        db.commit()


def block_provider(provider: str, hours: int, status: str, detail: str = "") -> None:
    until = utc_now() + timedelta(hours=hours)
    with SessionLocal() as db:
        row = db.get(ProviderState, provider)
        if row:
            row.status = status
            row.blocked_until = until
            row.detail = detail or None
            row.updated_at = utc_now()
        else:
            db.add(
                ProviderState(
                    provider=provider,
                    status=status,
                    blocked_until=until,
                    detail=detail or None,
                    updated_at=utc_now(),
                )
            )
        db.commit()


def clear_provider_block(provider: str) -> None:
    with SessionLocal() as db:
        row = db.get(ProviderState, provider)
        if row and row.status != "ok":
            row.status = "ok"
            row.blocked_until = None
            row.detail = None
            row.updated_at = utc_now()
            db.commit()


def provider_block(provider: str) -> tuple[str, str] | None:
    """Return (status, detail) while the provider is in cooldown, else None."""
    with SessionLocal() as db:
        row = db.get(ProviderState, provider)
        if not row or not row.blocked_until:
            return None
        if utc_now() >= as_utc_aware(row.blocked_until):
            row.status = "ok"
            row.blocked_until = None
            row.detail = None
            db.commit()
            return None
        return row.status, (row.detail or "")
