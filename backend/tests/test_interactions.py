from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.interactions import build_pair_summary
from app.services.suppai import (
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
    assert severity == "unknown"
    assert "bleeding" in summary.lower()
    assert "Supp.AI" in full


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
