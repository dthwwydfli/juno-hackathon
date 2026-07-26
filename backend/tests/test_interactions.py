from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.interactions import build_pair_summary
from app.services.suppai import (
    check_pair_suppai,
    fetch_interaction_evidence,
    normalize_search_query,
    pick_evidence_sentences,
)


def test_normalize_search_query_strips_strength_and_form():
    q = normalize_search_query("Paracetamol 500mg tablets (sample)")
    assert "500mg" not in q.lower()
    assert "paracetamol" in q.lower()


def test_build_pair_summary_uses_meddata_severity():
    row = {"severity": "major", "description": "Avoid combination.", "source": "FDA label"}
    severity, summary, full = build_pair_summary(
        "Drug A", "Drug B", row, None, ""
    )
    assert severity == "high"
    assert "Avoid combination" in summary
    assert "MedData" in full


def test_build_pair_summary_includes_suppai_evidence():
    suppai = {
        "evidence": [
            {
                "sentence": "Ginkgo may increase bleeding risk with warfarin.",
                "paper_title": "Example study",
                "paper_year": 2019,
            }
        ]
    }
    severity, summary, full = build_pair_summary(
        "Warfarin", "Ginkgo", None, suppai, ""
    )
    # Supp.AI carries no severity grade, but a literature-backed hit is a real
    # signal, so it must not be surfaced as "unknown".
    assert severity == "moderate"
    assert "bleeding" in summary.lower()
    assert "Supp.AI" in full


@pytest.mark.asyncio
async def test_check_pair_suppai_retries_empty_evidence():
    agent_a = {"cui": "C1", "ent_type": "supplement", "preferred_name": "Fish Oils"}
    agent_b = {"cui": "C2", "ent_type": "drug", "preferred_name": "Ramipril"}
    calls = 0

    async def fetch(_a, _b):
        nonlocal calls
        calls += 1
        if calls == 1:
            return {"interaction_id": "C1-C2", "evidence": []}
        return {
            "interaction_id": "C1-C2",
            "evidence": [
                {
                    "paper": {"retraction": False, "human_study": True},
                    "sentences": [{"spans": [{"text": "May affect blood pressure."}]}],
                }
            ],
        }

    with patch("app.services.suppai.fetch_interaction_evidence", AsyncMock(side_effect=fetch)):
        interaction, source = await check_pair_suppai(
            "Fish oil", "Ramipril", agent_a, agent_b, retry_empty_evidence=True
        )

    assert interaction is not None
    assert source is not None
    assert calls == 2


@pytest.mark.asyncio
async def test_fetch_interaction_evidence_tries_reversed_cui_order():
    responses = {
        "https://supp.ai/api/interaction/C1-C2": MagicMock(status_code=404),
        "https://supp.ai/api/interaction/C2-C1": MagicMock(
            status_code=200,
            json=lambda: {"interaction_id": "C2-C1", "evidence": []},
        ),
    }

    async def fake_get(url, **kwargs):
        path = str(url)
        resp = responses.get(path)
        if resp is None:
            raise AssertionError(f"unexpected url {path}")
        return resp

    mock_client = MagicMock()
    mock_client.get = AsyncMock(side_effect=fake_get)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.suppai.httpx.AsyncClient", return_value=mock_client):
        data = await fetch_interaction_evidence("C1", "C2")

    assert data is not None
    assert data["interaction_id"] == "C2-C1"
    assert mock_client.get.await_count == 2


@pytest.mark.asyncio
async def test_fetch_interaction_evidence_prefers_populated_order():
    """Supp.AI answers 200 for both orders but only fills one of them.

    Real case: C0043031-C0016157 (warfarin/fish oil) returns 0 sentences while
    C0016157-C0043031 returns 1, so a 200 on the first order must not win.
    """
    responses = {
        "https://supp.ai/api/interaction/C1-C2": MagicMock(
            status_code=200,
            json=lambda: {"interaction_id": "C1-C2", "evidence": []},
        ),
        "https://supp.ai/api/interaction/C2-C1": MagicMock(
            status_code=200,
            json=lambda: {"interaction_id": "C2-C1", "evidence": [{"sentences": []}]},
        ),
    }

    async def fake_get(url, **kwargs):
        return responses[str(url)]

    mock_client = MagicMock()
    mock_client.get = AsyncMock(side_effect=fake_get)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.suppai.httpx.AsyncClient", return_value=mock_client):
        data = await fetch_interaction_evidence("C1", "C2")

    assert data["interaction_id"] == "C2-C1"
    assert mock_client.get.await_count == 2


@pytest.mark.asyncio
async def test_check_pair_suppai_ignores_empty_evidence():
    """A 200 with no evidence is not an interaction; unrelated pairs return 200."""
    agent_a = {"cui": "C1", "ent_type": "supplement", "preferred_name": "Fish Oils"}
    agent_b = {"cui": "C2", "ent_type": "drug", "preferred_name": "Ramipril"}

    with patch(
        "app.services.suppai.fetch_interaction_evidence",
        AsyncMock(return_value={"interaction_id": "C1-C2", "evidence": []}),
    ):
        interaction, source = await check_pair_suppai("Fish oil", "Ramipril", agent_a, agent_b)

    assert interaction is None
    assert source is None


@pytest.mark.asyncio
async def test_check_pair_suppai_skips_drug_drug_pairs():
    """Supp.AI only holds supplement/drug data, so drug/drug never hits the network."""
    agent_a = {"cui": "C1", "ent_type": "drug", "preferred_name": "Aspirin"}
    agent_b = {"cui": "C2", "ent_type": "drug", "preferred_name": "Ibuprofen"}

    fetch = AsyncMock(return_value={"evidence": [{"sentences": []}]})
    with patch("app.services.suppai.fetch_interaction_evidence", fetch):
        interaction, source = await check_pair_suppai("Aspirin", "Ibuprofen", agent_a, agent_b)

    assert (interaction, source) == (None, None)
    fetch.assert_not_awaited()


def test_pick_evidence_sentences_skips_retracted():
    interaction = {
        "evidence": [
            {
                "paper": {"retraction": True, "human_study": True},
                "sentences": [{"spans": [{"text": "Bad paper."}]}],
            },
            {
                "paper": {"retraction": False, "human_study": True},
                "sentences": [{"spans": [{"text": "Good evidence."}]}],
            },
        ]
    }
    picked = pick_evidence_sentences(interaction, limit=2)
    assert len(picked) == 1
    assert picked[0]["sentence"] == "Good evidence."


def test_merge_pending_includes_unsaved_med_in_check_set():
    from app.db.models import MedCategory, Medication
    from app.services.interactions import PendingMedCheck, _merge_pending_meds

    db_meds = [
        Medication(
            id=1,
            user_id="u",
            display_name="Warfarin 3mg tablets",
            category=MedCategory.nhs_prescription,
            dosage="3mg",
            schedule="{}",
        )
    ]
    merged = _merge_pending_meds(
        db_meds, [PendingMedCheck(display_name="Clopidogrel 75", category=MedCategory.otc)]
    )
    assert len(merged) == 2
    assert any(m.display_name == "Clopidogrel 75" for m in merged)
    assert merged[1].id < 0
