from app.db.models import InteractionRecord, MedCategory, Medication
from app.services.gp_summary import format_gp_interaction_line, strip_severity_tags


def test_strip_severity_tags():
    assert strip_severity_tags("[moderate] Hello") == "Hello"
    assert strip_severity_tags("[moderate] [high] Pair") == "Pair"


def test_format_gp_interaction_line_uses_med_names():
    rec = InteractionRecord(
        user_id="u",
        med_a_id=1,
        med_b_id=2,
        severity="high",
        summary="[moderate] May affect absorption.",
        full_text="",
    )
    rec.med_a = Medication(
        id=1,
        user_id="u",
        display_name="Atorvastatin 20mg",
        category=MedCategory.nhs_prescription,
        dosage="1 tablet",
        schedule="{}",
    )
    rec.med_b = Medication(
        id=2,
        user_id="u",
        display_name="Omeprazole 20mg",
        category=MedCategory.nhs_prescription,
        dosage="1 capsule",
        schedule="{}",
    )
    line = format_gp_interaction_line(rec)
    assert line.startswith("Potential interaction:")
    assert "Atorvastatin 20mg and Omeprazole 20mg" in line
    assert "May affect absorption." in line
    assert ". May affect" in line or line.endswith("May affect absorption.")
    assert "\u2014" not in line
    assert "[moderate]" not in line
    assert "[high]" not in line


def test_format_gp_interaction_dedupes_generic_names_in_summary():
    rec = InteractionRecord(
        user_id="u",
        med_a_id=1,
        med_b_id=2,
        severity="moderate",
        summary="Atorvastatin and omeprazole may interact; discuss with a GP.",
        full_text="",
    )
    rec.med_a = Medication(
        id=1,
        user_id="u",
        display_name="Atorvastatin 20mg tablets",
        category=MedCategory.nhs_prescription,
        dosage="1 tablet",
        schedule="{}",
    )
    rec.med_b = Medication(
        id=2,
        user_id="u",
        display_name="Omeprazole 20mg capsules",
        category=MedCategory.nhs_prescription,
        dosage="1 capsule",
        schedule="{}",
    )
    line = format_gp_interaction_line(rec)
    assert "Atorvastatin 20mg tablets and Omeprazole 20mg capsules" in line
    assert "may interact" in line.lower()
    assert "Atorvastatin and omeprazole may interact" not in line
