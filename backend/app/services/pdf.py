import json
from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.db.models import MedCategory, Medication
from app.schemas.gp_snapshot import GpShareSnapshot
from app.services.gp_summary import strip_severity_tags

TEAL = colors.HexColor("#12A594")
AMBER = colors.HexColor("#C7791F")
INK = colors.HexColor("#1A1A17")
MUTED = colors.HexColor("#6B6B63")
RULE = colors.HexColor("#ECEBE6")

# GP-facing reading order: NHS prescriptions first, then OTC, then private.
CATEGORY_ORDER = {"NHS": 0, "OTC": 1, "Private": 2}


def _by_category(meds: list) -> list:
    return sorted(meds, key=lambda m: CATEGORY_ORDER.get(m.category, 99))


PDF_DISCLAIMER = (
    "Information only. Not medical advice or a diagnosis. Please discuss with your GP or "
    "pharmacist. Interaction data sourced from NHS · BNF via a healthcare API."
)


def build_gp_pdf_from_snapshot(snapshot: GpShareSnapshot) -> bytes:
    active = [m for m in snapshot.medications if m.status == "active"]
    archived = [m for m in snapshot.medications if m.status == "archived"]
    interactions = snapshot.interactions
    profile = snapshot.profile
    return _render_summary_pdf(
        name=profile.name,
        age=profile.age,
        gender=profile.gender,
        nhs_number=profile.nhs_number,
        generated=snapshot.last_synced,
        active=active,
        archived=archived,
        interactions=interactions,
    )


def build_gp_pdf(
    patient_label: str | None,
    active: list[Medication],
    archived: list[Medication],
    interaction_highlights: list[str],
    expires_at: datetime | None = None,
) -> bytes:
    """Legacy DB-driven PDF; maps meds/interactions into reference layout."""
    del expires_at  # not shown in reference layout
    name = patient_label or "Patient"
    active_rows = [_medication_from_db(m) for m in active]
    archived_rows = [_medication_from_db(m) for m in archived]
    interactions = [_interaction_from_highlight(h) for h in interaction_highlights]
    interactions = [i for i in interactions if i]
    return _render_summary_pdf(
        name=name,
        age=0,
        gender="",
        nhs_number="",
        generated=datetime.utcnow().strftime("%d %b %Y, %H:%M"),
        active=active_rows,
        archived=archived_rows,
        interactions=interactions,
    )


def _medication_from_db(m: Medication):
    from app.schemas.gp_snapshot import SnapshotMedication

    sched = _fmt_schedule_dict(m.schedule)
    return SnapshotMedication(
        name=_generic_from_display(m.display_name, m.dosage),
        dose=m.dosage or "",
        brand="",
        category=_fmt_category_short(m.category),
        scheduleLabel=sched.get("scheduleLabel") or None,
        times=sched.get("times") or [],
        route="Oral",
        status="archived" if m.archived_at else "active",
    )


def _generic_from_display(display_name: str, dosage: str) -> str:
    d = (dosage or "").strip()
    if d and display_name.endswith(d):
        return display_name[: -len(d)].strip()
    return display_name


def _interaction_from_highlight(line: str):
    from app.schemas.gp_snapshot import SnapshotInteraction

    text = line.strip()
    prefix = "Potential interaction:"
    if text.lower().startswith(prefix.lower()):
        text = text[len(prefix) :].strip()
    if ". " in text:
        pair_part, reason = text.split(". ", 1)
    else:
        pair_part, reason = text, ""
    pair_part = pair_part.strip()
    if " and " in pair_part:
        a, b = pair_part.split(" and ", 1)
        return SnapshotInteraction(
            a=a.strip(),
            b=b.strip(),
            reason=strip_severity_tags(reason).strip(),
        )
    if reason:
        return SnapshotInteraction(a="Medicines", b="", reason=strip_severity_tags(text))
    return None


def _render_summary_pdf(
    *,
    name: str,
    age: int,
    gender: str,
    nhs_number: str,
    generated: str,
    active: list,
    archived: list,
    interactions: list,
) -> bytes:
    buffer = BytesIO()
    w, h = A4
    m = 48
    top_y = h - m
    bottom_y = m
    c = canvas.Canvas(buffer, pagesize=A4)
    y = top_y

    def new_page():
        nonlocal y
        c.showPage()
        y = top_y

    def ensure_space(needed: float = 72):
        nonlocal y
        if y - needed < bottom_y:
            new_page()

    # Header
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(TEAL)
    c.drawString(m, y, "PHARMACY IN YOUR POCKET")
    c.setFillColor(MUTED)
    c.drawRightString(w - m, y, "MEDICATION SUMMARY")
    y -= 26
    c.setStrokeColor(RULE)
    c.setLineWidth(0.5)
    c.line(m, y, w - m, y)
    y -= 30

    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(INK)
    c.drawString(m, y, name)
    y -= 18
    c.setFont("Helvetica", 10)
    c.setFillColor(MUTED)
    if age and gender and nhs_number:
        demo = f"{age} · {gender} · NHS {nhs_number}"
    elif nhs_number:
        demo = f"NHS {nhs_number}"
    else:
        demo = patient_demo_fallback(name)
    c.drawString(m, y, demo)
    y -= 14
    c.drawString(m, y, f"Generated {generated}")
    y -= 34

    def section_heading(label: str, count: int) -> None:
        nonlocal y
        ensure_space(60)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(INK)
        c.drawString(m, y, f"{label} ({count})")
        y -= 8
        c.setStrokeColor(RULE)
        c.line(m, y, w - m, y)
        y -= 20

    def med_row(med) -> None:
        """Shared by current and archived so the two tables cannot drift apart."""
        nonlocal y
        ensure_space(40)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(INK)
        c.drawString(m, y, f"{med.name} {med.dose}".strip())
        c.setFont("Helvetica", 11)
        c.setFillColor(MUTED)
        c.drawRightString(w - m, y, med.category)
        y -= 14
        sched = med.schedule_label or (", ".join(med.times) if med.times else "")
        sub = " · ".join(p for p in [med.brand, sched, med.route] if p)
        c.setFont("Helvetica", 9.5)
        c.drawString(m, y, sub)
        y -= 22

    active = _by_category(active)
    archived = _by_category(archived)

    section_heading("CURRENT MEDICATIONS", len(active))
    for med in active:
        med_row(med)

    if archived:
        y -= 8
        section_heading("ARCHIVED", len(archived))
        for med in archived:
            med_row(med)

    y -= 8
    section_heading("POTENTIAL INTERACTIONS", len(interactions))

    for ix in interactions:
        ensure_space(56)
        c.setFont("Helvetica-Bold", 10.5)
        c.setFillColor(AMBER)
        pair = f"{ix.a}  +  {ix.b}" if ix.b else ix.a
        c.drawString(m, y, pair)
        y -= 14
        c.setFont("Helvetica", 9.5)
        c.setFillColor(MUTED)
        for line in _wrap_text(ix.reason, w - 2 * m, c):
            c.drawString(m, y, line)
            y -= 12
        y -= 12

    ensure_space(48)
    y -= 6
    c.setFont("Helvetica-Oblique", 8.5)
    c.setFillColor(MUTED)
    for line in _wrap_text(PDF_DISCLAIMER, w - 2 * m, c):
        c.drawString(m, y, line)
        y -= 10

    c.save()
    return buffer.getvalue()


def patient_demo_fallback(name: str) -> str:
    del name
    return ""


def _wrap_text(text: str, max_width: float, c: canvas.Canvas) -> list[str]:
    if not text:
        return [""]
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if c.stringWidth(trial, c._fontname, c._fontsize) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


def _fmt_category_short(category: MedCategory) -> str:
    labels = {
        MedCategory.nhs_prescription: "NHS",
        MedCategory.otc: "OTC",
        MedCategory.online: "Private",
    }
    return labels.get(category, category.value)


def _fmt_schedule_dict(raw: str) -> dict:
    try:
        s = json.loads(raw) if raw else {}
        if not isinstance(s, dict):
            return {}
        return {
            "times": s.get("times") or [],
            "scheduleLabel": s.get("scheduleLabel"),
        }
    except json.JSONDecodeError:
        return {}
