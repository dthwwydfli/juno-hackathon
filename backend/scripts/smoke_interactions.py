#!/usr/bin/env python3
"""Smoke-test interaction pipeline for scanned-style display names (live APIs)."""

import asyncio
import json
from dataclasses import dataclass

from app.config import settings
from app.services.drug_names import primary_lookup_name
from app.services.meddata import check_unified_interactions, find_pair_interaction
from app.services.suppai import check_pair_suppai, search_agent


@dataclass
class PairCase:
    name_a: str
    name_b: str


PAIRS = [
    PairCase("Warfarin 3mg tablets", "Fish oil 1000mg capsules"),
    PairCase("Aspirin 300mg tablets (demo GTIN)", "Ibuprofen 200mg tablets (sample)"),
    PairCase("Paracetamol 500mg tablets (sample)", "Ibuprofen 200mg tablets (sample)"),
    PairCase("Warfarin 3mg tablets", "Ginkgo biloba 120mg tablets"),
    PairCase("Atorvastatin 20mg film-coated tablets", "Grapefruit juice (online)"),
    PairCase("Metformin 500mg tablets", "Vitamin B12 1000mcg tablets"),
]

# Matches frontend/src/data/fixtures.ts active cabinet (dmdDisplayName values).
FIXTURE_CABINET = [
    "Atorvastatin 20mg film-coated tablets",
    "Warfarin 3mg tablets",
    "Aspirin 300mg tablets (demo GTIN)",
    "Ramipril 5 mg",
    "Metformin 500 mg",
    "Ibuprofen 200mg tablets (sample)",
    "Fish oil 1000mg capsules",
    "Grapefruit juice (online)",
]


async def evaluate_pair(case: PairCase) -> dict:
    meddata_row = None
    if settings.meddata_api_key:
        batch = await check_unified_interactions(
            [case.name_a, case.name_b]
        )
        meddata_row = find_pair_interaction(batch, case.name_a, case.name_b)

    suppai_called = meddata_row is None
    suppai_source = None
    if suppai_called:
        _, suppai_source = await check_pair_suppai(case.name_a, case.name_b)

    agent_a = await search_agent(case.name_a)
    agent_b = await search_agent(case.name_b)

    return {
        "med_a": case.name_a,
        "med_b": case.name_b,
        "lookup_a": primary_lookup_name(case.name_a),
        "lookup_b": primary_lookup_name(case.name_b),
        "meddata_hit": meddata_row is not None,
        "meddata_severity": (meddata_row or {}).get("severity"),
        "suppai_called": suppai_called,
        "suppai_hit": suppai_source is not None,
        "suppai_evidence": len((suppai_source or {}).get("evidence") or []),
        "suppai_interaction_id": (suppai_source or {}).get("interaction_id"),
        "agent_a": (agent_a or {}).get("preferred_name"),
        "agent_b": (agent_b or {}).get("preferred_name"),
    }


async def evaluate_fixture_cabinet() -> None:
    print("\n=== FIXTURE_CABINET batch (frontend blend) ===")
    if not settings.meddata_api_key:
        print("  skipped: no MEDDATA_API_KEY")
        return
    batch = await check_unified_interactions(FIXTURE_CABINET)
    if not batch:
        print("  no batch result (API error or quota)")
        return
    rows = batch.get("interactions") or []
    print(f"  interaction count: {len(rows)}")
    for row in rows:
        print(
            f"  - {row.get('item_1_name')} + {row.get('item_2_name')}"
            f" | {row.get('severity')}"
        )
    expected_pairs = [
        ("Warfarin 3mg tablets", "Fish oil 1000mg capsules"),
        ("Aspirin 300mg tablets (demo GTIN)", "Ibuprofen 200mg tablets (sample)"),
        ("Atorvastatin 20mg film-coated tablets", "Grapefruit juice (online)"),
    ]
    print("  expected pair hits:")
    for name_a, name_b in expected_pairs:
        hit = find_pair_interaction(batch, name_a, name_b)
        print(f"    {'yes' if hit else 'no'}: {name_a} + {name_b}")


async def main() -> None:
    print("MEDDATA_API_KEY set:", bool(settings.meddata_api_key))
    results = []
    for case in PAIRS:
        row = await evaluate_pair(case)
        results.append(row)
        print("---")
        print(f"{row['med_a']} + {row['med_b']}")
        print(
            f"  lookup: {row['lookup_a']} | {row['lookup_b']}"
        )
        print(
            f"  meddata: {'yes' if row['meddata_hit'] else 'no'}"
            f"  suppai_called: {row['suppai_called']}"
            f"  suppai_hit: {row['suppai_hit']}"
            f"  evidence: {row['suppai_evidence']}"
        )
        if row["agent_a"] or row["agent_b"]:
            print(f"  agents: {row['agent_a']} + {row['agent_b']}")
        if row["suppai_interaction_id"]:
            print(f"  suppai_id: {row['suppai_interaction_id']}")

    await evaluate_fixture_cabinet()

    print("\nJSON summary:")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
