from __future__ import annotations

import re
from typing import Any

import httpx

from app.services.drug_names import lookup_query_variants, primary_lookup_name

SUPP_AI_BASE = "https://supp.ai/api"

_LOW_VALUE = re.compile(
    r"\b(emulsion|intravenous|iv\b|parenteral|lipid emulsion|/glycerol/|"
    r"based emulsion|infusion|neonat)\b",
    re.I,
)


def normalize_search_query(display_name: str) -> str:
    return primary_lookup_name(display_name)


def _normalize_name(name: str) -> str:
    return name.strip().lower()


def _agent_matches_query(agent: dict[str, Any], query: str) -> bool:
    q = _normalize_name(query)
    if not q:
        return False
    preferred = _normalize_name(agent.get("preferred_name") or "")
    if q in preferred or preferred in q:
        return True
    q_tokens = [t for t in q.split() if len(t) >= 3]
    if not q_tokens:
        return False
    hay = preferred
    for syn in agent.get("synonyms") or []:
        hay += " " + _normalize_name(str(syn))
    for trade in agent.get("tradenames") or []:
        hay += " " + _normalize_name(str(trade))
    if any(t in hay for t in q_tokens):
        return True
    matches = agent.get("matches") or {}
    return bool(matches)


def _score_agent(agent: dict[str, Any], query: str) -> float:
    q = _normalize_name(query)
    preferred = _normalize_name(agent.get("preferred_name") or "")
    score = 0.0
    if q == preferred:
        score += 50
    elif q in preferred or preferred in q:
        score += 30
    for t in q.split():
        if len(t) >= 3 and t in preferred:
            score += 10
    if _LOW_VALUE.search(preferred):
        score -= 40
    ent = agent.get("ent_type") or ""
    if ent in ("supplement", "drug"):
        score += 5
    count = agent.get("interacts_with_count")
    if count:
        score += min(int(count) / 20, 5)
    return score


async def _search_agents(query: str) -> list[dict[str, Any]]:
    if len(query) < 2:
        return []
    url = f"{SUPP_AI_BASE}/agent/search"
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(url, params={"q": query, "p": 0})
            if resp.status_code >= 400:
                return []
            data = resp.json()
    except httpx.HTTPError:
        return []
    return list(data.get("results") or [])


async def search_agent(display_name: str) -> dict[str, Any] | None:
    best: dict[str, Any] | None = None
    best_score = float("-inf")
    for query in lookup_query_variants(display_name):
        for agent in await _search_agents(query):
            if not _agent_matches_query(agent, query):
                continue
            score = _score_agent(agent, query)
            if score > best_score:
                best_score = score
                best = agent
        if best is not None and best_score >= 25:
            break
    return best


async def fetch_interaction_evidence(
    cui_a: str, cui_b: str
) -> dict[str, Any] | None:
    """Fetch pair evidence, trying both CUI orders.

    Supp.AI answers 200 for either order but only fills `evidence` on one of
    them (warfarin/fish oil: C0043031-C0016157 -> 0 sentences, the reverse -> 1),
    so both orders are always tried and the populated one wins. A 200 with no
    evidence is not an interaction: unrelated pairs answer 200 as well.
    """
    if not cui_a or not cui_b or cui_a == cui_b:
        return None
    fallback: dict[str, Any] | None = None
    for iid in (f"{cui_a}-{cui_b}", f"{cui_b}-{cui_a}"):
        url = f"{SUPP_AI_BASE}/interaction/{iid}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(url)
        except httpx.HTTPError:
            continue
        if resp.status_code == 404:
            continue
        if resp.status_code >= 400:
            continue
        try:
            data = resp.json()
        except ValueError:
            continue
        if data.get("evidence"):
            return data
        fallback = fallback or data
    return fallback


def pick_evidence_sentences(
    interaction: dict[str, Any], limit: int = 2
) -> list[dict[str, Any]]:
    picked: list[dict[str, Any]] = []
    for ev in interaction.get("evidence") or []:
        paper = ev.get("paper") or {}
        if paper.get("retraction"):
            continue
        if paper.get("animal_study") and not paper.get("human_study"):
            continue
        for sent in ev.get("sentences") or []:
            spans = sent.get("spans") or []
            text = " ".join(
                str(s.get("text", "")).strip() for s in spans if s.get("text")
            ).strip()
            if not text:
                continue
            picked.append(
                {
                    "sentence": text,
                    "paper_title": paper.get("title"),
                    "paper_year": paper.get("year"),
                    "pmid": paper.get("pmid"),
                    "human_study": paper.get("human_study"),
                }
            )
            if len(picked) >= limit:
                return picked
    return picked


def suppai_source_entry(
    interaction: dict[str, Any],
    evidence: list[dict[str, Any]],
    name_a: str,
    name_b: str,
) -> dict[str, Any]:
    return {
        "source": "suppai",
        "field": "interaction_evidence",
        "interaction_id": interaction.get("interaction_id"),
        "slug": interaction.get("slug"),
        "item_1": name_a,
        "item_2": name_b,
        "evidence": evidence,
        "note": (
            "Literature-derived supplement/drug interactions (UMLS/RxNorm); "
            "may not match UK dm+d pack names."
        ),
    }


def is_supplement(agent: dict[str, Any] | None) -> bool:
    return bool(agent) and (agent.get("ent_type") or "") == "supplement"


async def check_pair_suppai(
    name_a: str,
    name_b: str,
    agent_a: dict[str, Any] | None = None,
    agent_b: dict[str, Any] | None = None,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """Look up a pair. Agents can be passed in so they are resolved once per med."""
    if agent_a is None:
        agent_a = await search_agent(name_a)
    if agent_b is None:
        agent_b = await search_agent(name_b)
    if not agent_a or not agent_b:
        return None, None
    # Supp.AI only carries supplement/drug pairs; drug/drug always comes back empty.
    if not is_supplement(agent_a) and not is_supplement(agent_b):
        return None, None
    cui_a = agent_a.get("cui")
    cui_b = agent_b.get("cui")
    if not cui_a or not cui_b:
        return None, None
    interaction = await fetch_interaction_evidence(str(cui_a), str(cui_b))
    if not interaction:
        return None, None
    evidence = pick_evidence_sentences(interaction)
    if not evidence:
        # 200 with no usable sentences means no interaction, not an unknown one.
        return None, None
    return interaction, suppai_source_entry(interaction, evidence, name_a, name_b)
