"""Idempotent demo cabinet data for GP QR hackathon demos."""

import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import InteractionRecord, MedCategory, Medication

DEMO_USER_ID = "demo"

_DEMO_MEDS: list[dict] = [
    {
        "display_name": "Atorvastatin 20mg tablets",
        "category": MedCategory.nhs_prescription,
        "dosage": "1 tablet at night",
        "schedule": {"times": ["22:00"]},
        "started_at": datetime(2025, 11, 1),
        "archived_at": None,
    },
    {
        "display_name": "Omeprazole 20mg capsules",
        "category": MedCategory.nhs_prescription,
        "dosage": "1 capsule",
        "schedule": {"times": ["08:00"]},
        "started_at": datetime(2026, 1, 15),
        "archived_at": None,
    },
    {
        "display_name": "Paracetamol 500mg tablets",
        "category": MedCategory.otc,
        "dosage": "2 tablets",
        "schedule": {"times": ["08:00", "20:00"]},
        "started_at": datetime(2025, 9, 10),
        "archived_at": None,
    },
    {
        "display_name": "Vitamin D3 1000 IU",
        "category": MedCategory.online,
        "dosage": "1 capsule",
        "schedule": {"times": ["09:00"]},
        "started_at": datetime(2025, 12, 1),
        "archived_at": None,
    },
    {
        "display_name": "Amoxicillin 500mg capsules",
        "category": MedCategory.nhs_prescription,
        "dosage": "1 capsule three times daily",
        "schedule": {"times": ["08:00", "14:00", "20:00"]},
        "started_at": datetime(2025, 6, 1),
        "archived_at": datetime(2025, 6, 14),
    },
    {
        "display_name": "Ibuprofen 400mg tablets",
        "category": MedCategory.otc,
        "dosage": "1 tablet as needed",
        "schedule": {"times": ["as_needed"]},
        "started_at": datetime(2024, 3, 20),
        "archived_at": datetime(2025, 2, 1),
    },
]

_DEMO_INTERACTION_SUMMARY = (
    "Atorvastatin and omeprazole may interact; discuss timing "
    "and monitoring with a pharmacist or GP."
)

# MedData smoke-verified display names (scripts/smoke_interactions.py)
_MEDDATA_DEMO_MEDS: list[dict] = [
    {
        "display_name": "Warfarin 3mg tablets",
        "category": MedCategory.nhs_prescription,
        "dosage": "1 tablet daily",
        "schedule": {"times": ["20:00"]},
        "started_at": datetime(2026, 1, 1),
    },
    {
        "display_name": "Fish oil 1000mg capsules",
        "category": MedCategory.otc,
        "dosage": "1 capsule daily",
        "schedule": {"times": ["12:00"]},
        "started_at": datetime(2026, 1, 1),
    },
    {
        "display_name": "Aspirin 300mg tablets (demo GTIN)",
        "category": MedCategory.otc,
        "dosage": "1 tablet as needed",
        "schedule": {"times": ["as_needed"]},
        "started_at": datetime(2026, 2, 1),
    },
    {
        "display_name": "Ibuprofen 200mg tablets (sample)",
        "category": MedCategory.otc,
        "dosage": "1 tablet as needed",
        "schedule": {"times": ["as_needed"]},
        "started_at": datetime(2026, 2, 1),
    },
    {
        "display_name": "Atorvastatin 20mg film-coated tablets",
        "category": MedCategory.nhs_prescription,
        "dosage": "1 tablet at night",
        "schedule": {"times": ["22:00"]},
        "started_at": datetime(2025, 11, 1),
    },
    {
        "display_name": "Grapefruit juice (online)",
        "category": MedCategory.online,
        "dosage": "With breakfast",
        "schedule": {"times": ["08:00"]},
        "started_at": datetime(2026, 3, 1),
    },
    {
        "display_name": "Ginkgo biloba 120mg tablets",
        "category": MedCategory.otc,
        "dosage": "1 tablet daily",
        "schedule": {"times": ["09:00"]},
        "started_at": datetime(2026, 3, 1),
    },
]


def seed_meddata_demo_cabinet(db: Session, user_id: str = DEMO_USER_ID) -> None:
    """Replace demo user's cabinet with meds that return MedData interaction hits."""
    db.query(InteractionRecord).filter(InteractionRecord.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(Medication).filter(Medication.user_id == user_id).delete(
        synchronize_session=False
    )
    db.flush()
    for spec in _MEDDATA_DEMO_MEDS:
        db.add(
            Medication(
                user_id=user_id,
                display_name=spec["display_name"],
                category=spec["category"],
                dosage=spec["dosage"],
                schedule=json.dumps(spec["schedule"]),
                started_at=spec["started_at"],
                archived_at=None,
            )
        )
    db.commit()


def seed_demo_cabinet(db: Session, user_id: str = DEMO_USER_ID) -> None:
    """Ensure demo user has mock active/archived meds and one interaction highlight."""
    name_to_med: dict[str, Medication] = {}
    for spec in _DEMO_MEDS:
        existing = (
            db.query(Medication)
            .filter(
                Medication.user_id == user_id,
                Medication.display_name == spec["display_name"],
            )
            .first()
        )
        if existing:
            name_to_med[spec["display_name"]] = existing
            continue
        med = Medication(
            user_id=user_id,
            display_name=spec["display_name"],
            category=spec["category"],
            dosage=spec["dosage"],
            schedule=json.dumps(spec["schedule"]),
            started_at=spec["started_at"],
            archived_at=spec["archived_at"],
        )
        db.add(med)
        db.flush()
        name_to_med[spec["display_name"]] = med

    db.commit()

    ator = name_to_med.get("Atorvastatin 20mg tablets")
    omep = name_to_med.get("Omeprazole 20mg capsules")
    if not ator or not omep:
        return

    pair = (
        db.query(InteractionRecord)
        .filter(
            InteractionRecord.user_id == user_id,
            InteractionRecord.med_a_id == ator.id,
            InteractionRecord.med_b_id == omep.id,
        )
        .first()
    )
    if pair:
        if pair.summary != _DEMO_INTERACTION_SUMMARY:
            pair.summary = _DEMO_INTERACTION_SUMMARY
            pair.full_text = _DEMO_INTERACTION_SUMMARY
            db.commit()
        return

    db.add(
        InteractionRecord(
            user_id=user_id,
            med_a_id=ator.id,
            med_b_id=omep.id,
            severity="moderate",
            summary=_DEMO_INTERACTION_SUMMARY,
            full_text=_DEMO_INTERACTION_SUMMARY,
            sources="[]",
        )
    )
    db.commit()
