from __future__ import annotations

import itertools
import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.config import settings
from app.services.api_cache import (
    block_provider,
    clear_provider_block,
    fingerprint,
    provider_block,
    read_cache,
    write_cache,
)
from app.services.drug_names import primary_lookup_name

log = logging.getLogger(__name__)

PROVIDER = "meddata"
MAX_ITEMS_PER_REQUEST = 10

_SEVERITY_MAP = {
    "contraindicated": "high",
    "major": "high",
    "high": "high",
    "moderate": "moderate",
    "minor": "low",
    "low": "low",
}


@dataclass
class MedDataResult:
    """Outcome of a MedData lookup.

    `status` matters: empty rows with status "ok" means "no interactions found",
    while "quota_exceeded"/"unavailable" mean we never got an answer. Collapsing
    the two into None is what made an API outage look like a clean bill of health.
    """

    status: str  # ok | quota_exceeded | unavailable | not_configured
    data: dict[str, Any] | None = None
    detail: str = ""
    requests_made: int = 0
    rows: list[dict[str, Any]] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.status == "ok"


def map_meddata_severity(raw: str | None) -> str:
    if not raw:
        return "unknown"
    key = raw.strip().lower()
    return _SEVERITY_MAP.get(key, "moderate" if key else "unknown")


def _normalize_name(name: str) -> str:
    return name.strip().lower()


def _match_tokens(name: str) -> set[str]:
    """Names a MedData row item is allowed to match against."""
    lookup = _normalize_name(primary_lookup_name(name))
    raw = _normalize_name(name)
    tokens = {lookup, raw}
    if lookup:
        tokens.add(lookup.split()[0])
    if raw:
        tokens.add(raw.split()[0])
    return {t for t in tokens if t}


def _names_match(a: str, b: str, name_a: str, name_b: str) -> bool:
    """True when MedData row items {a, b} describe the pair {name_a, name_b}."""
    ia, ib = _match_tokens(a), _match_tokens(b)
    ta, tb = _match_tokens(name_a), _match_tokens(name_b)
    forward = bool(ia & ta) and bool(ib & tb)
    reverse = bool(ia & tb) and bool(ib & ta)
    return forward or reverse


def find_pair_interaction(
    check_result: dict[str, Any] | None, name_a: str, name_b: str
) -> dict[str, Any] | None:
    if not check_result:
        return None
    for row in check_result.get("interactions") or []:
        i1 = row.get("item_1_name") or ""
        i2 = row.get("item_2_name") or ""
        if _names_match(i1, i2, name_a, name_b):
            return row
    return None


def meddata_source_entry(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "source": "meddata",
        "field": "interaction",
        "severity": row.get("severity"),
        "description": row.get("description"),
        "citation": row.get("source"),
        "item_1": row.get("item_1_name"),
        "item_2": row.get("item_2_name"),
        "note": "US RxNorm/FDA/NIH-backed interaction data; may not match UK dm+d packs.",
    }


def _request_chunks(names: list[str]) -> list[list[str]]:
    """Split into <=10-item requests so that every pair still shares a request."""
    if len(names) <= MAX_ITEMS_PER_REQUEST:
        return [names]
    half = MAX_ITEMS_PER_REQUEST // 2
    groups = [names[i : i + half] for i in range(0, len(names), half)]
    return [ga + gb for ga, gb in itertools.combinations(groups, 2)]


def _error_detail(resp: httpx.Response) -> str:
    try:
        body = resp.json()
    except ValueError:
        return resp.text[:200].strip()
    if isinstance(body, dict):
        return str(body.get("detail") or body.get("message") or "")[:200]
    return str(body)[:200]


async def _fetch_chunk(names: list[str]) -> MedDataResult:
    key = fingerprint(PROVIDER, names)
    cached = read_cache(PROVIDER, key, settings.meddata_cache_ttl_hours)
    if cached is not None:
        log.info("MedData cache hit for %d items", len(names))
        return MedDataResult(status="ok", data=cached, detail="cache")

    blocked = provider_block(PROVIDER)
    if blocked:
        status, detail = blocked
        log.warning("MedData in cooldown (%s): %s", status, detail)
        return MedDataResult(status=status, detail=detail)

    url = f"{settings.meddata_base_url.rstrip('/')}/api/v1/interactions/check"
    headers = {"X-API-Key": settings.meddata_api_key}
    params = {"items": ",".join(names)}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=headers, params=params)
    except httpx.HTTPError as e:
        log.warning("MedData request failed: %s", e)
        return MedDataResult(status="unavailable", detail=str(e), requests_made=1)

    log.info("MedData request: %d items -> HTTP %d", len(names), resp.status_code)

    if resp.status_code in (402, 429):
        detail = _error_detail(resp) or "MedData monthly request limit reached."
        block_provider(
            PROVIDER, settings.meddata_quota_cooldown_hours, "quota_exceeded", detail
        )
        return MedDataResult(status="quota_exceeded", detail=detail, requests_made=1)

    if resp.status_code in (401, 403):
        detail = _error_detail(resp) or "MedData rejected the API key."
        block_provider(
            PROVIDER, settings.meddata_quota_cooldown_hours, "unavailable", detail
        )
        return MedDataResult(status="unavailable", detail=detail, requests_made=1)

    if resp.status_code >= 400:
        detail = _error_detail(resp) or f"MedData returned HTTP {resp.status_code}."
        return MedDataResult(status="unavailable", detail=detail, requests_made=1)

    try:
        data = resp.json()
    except ValueError as e:
        return MedDataResult(status="unavailable", detail=str(e), requests_made=1)

    clear_provider_block(PROVIDER)
    write_cache(PROVIDER, key, data)
    return MedDataResult(status="ok", data=data, requests_made=1)


async def check_unified_interactions(item_names: list[str]) -> MedDataResult:
    """One batched lookup per cabinet state; cached so repeats cost no quota."""
    if not settings.meddata_api_key:
        return MedDataResult(
            status="not_configured", detail="MEDDATA_API_KEY is not set."
        )

    names: list[str] = []
    for raw in item_names:
        if not raw or not raw.strip():
            continue
        name = primary_lookup_name(raw.strip())
        if name and name not in names:
            names.append(name)
    if len(names) < 2:
        return MedDataResult(status="ok", data={"interactions": []})

    rows: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    requests_made = 0
    failure: MedDataResult | None = None

    for chunk in _request_chunks(names):
        result = await _fetch_chunk(chunk)
        requests_made += result.requests_made
        if not result.ok:
            failure = failure or result
            continue
        for row in (result.data or {}).get("interactions") or []:
            pair = (
                _normalize_name(row.get("item_1_name") or ""),
                _normalize_name(row.get("item_2_name") or ""),
            )
            key = tuple(sorted(pair))
            if key in seen:
                continue
            seen.add(key)
            rows.append(row)

    if failure and not rows:
        failure.requests_made = requests_made
        return failure

    return MedDataResult(
        status="ok",
        data={"interactions": rows},
        rows=rows,
        requests_made=requests_made,
    )
