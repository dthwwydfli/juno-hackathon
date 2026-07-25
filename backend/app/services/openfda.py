import json
from typing import Any

import httpx

from app.config import settings
from app.services.drug_names import lookup_query_variants, primary_lookup_name

OPENFDA_BASE = "https://api.fda.gov/drug/label.json"


async def fetch_label_snippets(drug_name: str) -> list[dict[str, Any]]:
    """Search OpenFDA for drug_interactions and warnings sections."""
    term = primary_lookup_name(drug_name) if drug_name else ""
    if not term or len(term) < 3:
        return []

    snippets: list[dict[str, Any]] = []
    seen_excerpt: set[str] = set()

    for query in lookup_query_variants(drug_name):
        search_term = query if len(query) >= 3 else query.split()[0] if query else ""
        if not search_term or len(search_term) < 3:
            continue
        params: dict[str, Any] = {
            "search": (
                f'openfda.brand_name:"{search_term}" OR '
                f'openfda.generic_name:"{search_term}"'
            ),
            "limit": 3,
        }
        if settings.openfda_api_key:
            params["api_key"] = settings.openfda_api_key
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(OPENFDA_BASE, params=params)
                if resp.status_code != 200:
                    continue
                data = resp.json()
        except httpx.HTTPError:
            continue

        for result in data.get("results", []):
            for field in ("drug_interactions", "warnings", "warnings_and_cautions"):
                parts = result.get(field)
                if not parts:
                    continue
                text = parts[0] if isinstance(parts, list) else str(parts)
                if len(text) > 4000:
                    text = text[:4000] + "…"
                key = text[:200]
                if key in seen_excerpt:
                    continue
                seen_excerpt.add(key)
                snippets.append(
                    {
                        "source": "openfda",
                        "field": field,
                        "drug_query": term,
                        "excerpt": text,
                        "note": "US FDA label; may not match UK dm+d product exactly.",
                    }
                )
        if snippets:
            break
    return snippets


def extract_relevant_pair_text(
    snippets_a: list[dict], snippets_b: list[dict], name_b: str
) -> str:
    """Find excerpts mentioning the other medicine (using parsed lookup tokens)."""
    lookup = primary_lookup_name(name_b).lower()
    tokens = [t for t in lookup.split() if len(t) >= 3]
    if not tokens:
        tokens = [name_b.lower().split()[0]] if name_b.split() else []

    hits: list[str] = []
    for s in snippets_a + snippets_b:
        ex_lower = s.get("excerpt", "").lower()
        if any(t in ex_lower for t in tokens):
            hits.append(s.get("excerpt", "")[:1500])
    return "\n---\n".join(hits) if hits else ""


def sources_json(snippets: list[dict]) -> str:
    return json.dumps(snippets[:10])
