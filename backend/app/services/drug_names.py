from __future__ import annotations

import re

_PARENS = re.compile(r"\([^)]*\)")
_STRENGTH = re.compile(r"\b\d+(\.\d+)?\s*(mg|mcg|g|ml|%|iu|mmol|units?)\b", re.I)
_FORM_WORDS = re.compile(
    r"\b(tablets?|capsules?|caplets?|film[- ]coated|gastro[- ]resistant|"
    r"hard|soft|chewable|effervescent|sachets?|solution|suspension|"
    r"injection|cream|gel|ointment|patch|spray|drops?|powder|granules|"
    r"modified[- ]release|prolonged[- ]release|mr|sr|xl|lozenges?)\b",
    re.I,
)
_NOISE = re.compile(
    r"\b(sample|demo|pack|pk|hospital|unit dose|blister|generic|brand)\b",
    re.I,
)

_MULTI_WORD_INGREDIENTS = (
    "fish oil",
    "cod liver oil",
    "omega-3",
    "omega 3",
    "vitamin d",
    "vitamin c",
    "vitamin b12",
    "folic acid",
    "st john's wort",
    "coenzyme q10",
    "co q10",
    "ginkgo biloba",
    "grapefruit juice",
)


def _clean(display_name: str) -> str:
    text = display_name.strip()
    text = _PARENS.sub(" ", text)
    text = _STRENGTH.sub(" ", text)
    text = _FORM_WORDS.sub(" ", text)
    text = _NOISE.sub(" ", text)
    text = re.sub(r"[^\w\s\-']", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def primary_lookup_name(display_name: str) -> str:
    """Best single string for MedData / OpenFDA / Supp.AI search."""
    variants = lookup_query_variants(display_name)
    return variants[0] if variants else display_name.strip()


def lookup_query_variants(display_name: str) -> list[str]:
    """Ordered queries from a scanned pack display name (longest/most specific first)."""
    raw = display_name.strip()
    cleaned = _clean(raw)
    lower_raw = raw.lower()
    seen: set[str] = set()
    out: list[str] = []

    def add(q: str) -> None:
        q = re.sub(r"\s+", " ", q.strip())
        key = q.lower()
        if len(q) < 2 or key in seen:
            return
        seen.add(key)
        out.append(q)

    for phrase in _MULTI_WORD_INGREDIENTS:
        if phrase in lower_raw:
            add(phrase.title() if phrase.isascii() else phrase)

    if cleaned:
        add(cleaned)
        parts = cleaned.split()
        if len(parts) >= 2:
            add(" ".join(parts[:2]))
        if parts:
            add(parts[0])

    add(raw)
    return out
