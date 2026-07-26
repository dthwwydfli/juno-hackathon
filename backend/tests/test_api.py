import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def ensure_dmd():
    from pathlib import Path
    import subprocess
    import sys

    data = Path(__file__).resolve().parent.parent / "data"
    sample = data / "dmd.sample.sqlite"
    dmd = data / "dmd.sqlite"
    if not sample.exists() or not dmd.exists():
        script = Path(__file__).resolve().parent.parent / "scripts" / "build_sample_dmd.py"
        subprocess.run([sys.executable, str(script)], check=True)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body.get("app_db_backend") == "sqlite"
    assert body.get("app_db_ok") is True
    assert "dmd_gtin_count" in body
    assert "dmd_ready" in body
    assert "trud_configured" in body


def test_lookup_gtin():
    import sqlite3
    from pathlib import Path

    db = Path(__file__).resolve().parent.parent / "data" / "dmd.sqlite"
    conn = sqlite3.connect(db)
    row = conn.execute(
        "SELECT gtin FROM gtin_lookup WHERE gtin != '' AND length(gtin) >= 8 LIMIT 1"
    ).fetchone()
    conn.close()
    assert row, "dm+d database has no GTIN rows for lookup test"
    r = client.get("/lookup/barcode", params={"code": row[0]})
    assert r.status_code == 200
    body = r.json()
    assert body["found"] is True
    assert body["display_name"]


def test_medication_crud():
    r = client.post(
        "/medications",
        headers={"X-User-Id": "test-user"},
        json={
            "display_name": "Test Med",
            "category": "otc",
            "dosage": "1 tablet",
            "schedule": {"times": ["08:00"]},
        },
    )
    assert r.status_code == 201
    med_id = r.json()["id"]
    r2 = client.get("/medications", headers={"X-User-Id": "test-user"})
    assert any(m["id"] == med_id for m in r2.json())
    r3 = client.patch(
        f"/medications/{med_id}",
        headers={"X-User-Id": "test-user"},
        json={"archive": True},
    )
    assert r3.status_code == 200
    assert r3.json()["archived_at"] is not None


def test_gp_share_pdf_and_token_errors():
    uid = "gp-test-user"
    started = "2025-01-01T00:00:00"
    r = client.post(
        "/medications",
        headers={"X-User-Id": uid},
        json={
            "display_name": "GP Active Med",
            "category": "nhs_prescription",
            "dosage": "1 tablet",
            "schedule": {"times": ["08:00"]},
            "started_at": started,
        },
    )
    assert r.status_code == 201
    active_id = r.json()["id"]
    r2 = client.post(
        "/medications",
        headers={"X-User-Id": uid},
        json={
            "display_name": "GP Active Med B",
            "category": "otc",
            "dosage": "1 tablet",
            "schedule": {"times": ["12:00"]},
            "started_at": started,
        },
    )
    assert r2.status_code == 201
    active_b_id = r2.json()["id"]
    r_arch = client.post(
        "/medications",
        headers={"X-User-Id": uid},
        json={
            "display_name": "GP Archived Med",
            "category": "otc",
            "dosage": "2 tablets",
            "schedule": {"times": ["20:00"]},
            "started_at": "2024-06-01T00:00:00",
        },
    )
    assert r_arch.status_code == 201
    arch_id = r_arch.json()["id"]
    client.patch(
        f"/medications/{arch_id}",
        headers={"X-User-Id": uid},
        json={"archive": True},
    )

    from app.db.models import InteractionRecord, SessionLocal

    db_ix = SessionLocal()
    try:
        db_ix.add(
            InteractionRecord(
                user_id=uid,
                med_a_id=active_id,
                med_b_id=active_b_id,
                severity="high",
                summary="[moderate] Combined use may need review.",
                full_text="detail",
            )
        )
        db_ix.commit()
    finally:
        db_ix.close()

    share = client.post(
        "/gp/share-token",
        headers={"X-User-Id": uid, "Content-Type": "application/json"},
        json={
            "patient_label": "Jordan Ellis",
            "snapshot": {
                "profile": {
                    "name": "Jordan Ellis",
                    "age": 34,
                    "gender": "Female",
                    "nhsNumber": "485 777 3456",
                },
                "lastSynced": "25 Jul 2026, 09:41",
                "medications": [
                    {
                        "name": "Ramipril",
                        "dose": "5 mg",
                        "brand": "Tritace",
                        "category": "NHS",
                        "scheduleLabel": "Once daily, morning",
                        "times": ["Morning"],
                        "route": "Oral",
                        "status": "active",
                    }
                ],
                "interactions": [
                    {
                        "a": "Ramipril",
                        "b": "Ibuprofen",
                        "reason": "Combined use may need review.",
                    }
                ],
            },
        },
    )
    assert share.status_code == 200
    body = share.json()
    assert body["pdf_url"].endswith(f"/gp/summary/{body['token']}.pdf")
    assert body["qr_url"] == body["pdf_url"]

    pdf = client.get(f"/gp/summary/{body['token']}.pdf")
    assert pdf.status_code == 200
    assert "application/pdf" in pdf.headers.get("content-type", "")
    assert pdf.content.startswith(b"%PDF")

    summary = client.get(f"/gp/summary/{body['token']}")
    assert summary.status_code == 200
    snap = summary.json()
    assert snap["patient_label"] == "Jordan Ellis"
    assert snap["last_synced"] == "25 Jul 2026, 09:41"
    assert len(snap["active"]) == 1
    highlights = snap["interaction_highlights"]
    assert highlights
    assert "Ramipril" in highlights[0]
    assert "[moderate]" not in highlights[0]

    legacy_share = client.post(
        "/gp/share-token",
        headers={"X-User-Id": uid, "Content-Type": "application/json"},
        json={"patient_label": "Test patient"},
    )
    assert legacy_share.status_code == 200
    legacy_body = legacy_share.json()
    legacy_summary = client.get(f"/gp/summary/{legacy_body['token']}")
    legacy_highlights = legacy_summary.json()["interaction_highlights"]
    assert legacy_highlights
    assert "Potential interaction" in legacy_highlights[0]
    assert "[moderate]" not in legacy_highlights[0]
    assert "[high]" not in legacy_highlights[0]

    bad = client.get("/gp/summary/invalid-token-xyz.pdf")
    assert bad.status_code == 404

    from datetime import datetime, timedelta

    from app.db.models import GpShareToken, SessionLocal

    db = SessionLocal()
    try:
        expired_token = "expired-gp-test-token"
        db.query(GpShareToken).filter(GpShareToken.token == expired_token).delete()
        db.add(
            GpShareToken(
                token=expired_token,
                user_id=uid,
                patient_label=None,
                expires_at=datetime.utcnow() - timedelta(hours=1),
            )
        )
        db.commit()
    finally:
        db.close()

    expired = client.get(f"/gp/summary/{expired_token}.pdf")
    assert expired.status_code == 410


def test_gp_demo_share():
    r = client.post("/gp/demo-share", headers={"X-User-Id": "demo"})
    assert r.status_code == 200
    token = r.json()["token"]
    pdf = client.get(f"/gp/summary/{token}.pdf")
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF")

    forbidden = client.post("/gp/demo-share", headers={"X-User-Id": "other-user"})
    assert forbidden.status_code == 403
