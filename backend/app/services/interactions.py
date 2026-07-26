import asyncio
import itertools
import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.config import DISCLAIMER
from app.db.models import InteractionRecord, Medication
from app.services.drug_names import primary_lookup_name
from app.services.meddata import (
    MedDataResult,
    check_unified_interactions,
    find_pair_interaction,
    map_meddata_severity,
    meddata_source_entry,
)
from app.services.openfda import sources_json
from app.services.suppai import check_pair_suppai, is_supplement, search_agent

log = logging.getLogger(__name__)

# Supp.AI is unmetered but per-pair; keep a lid on parallel sockets.
_SUPPAI_CONCURRENCY = 6


_LABEL_COMENTION_PREFIX = "named in the fda drug label"


def _is_label_comention(description: str) -> bool:
    return description.strip().lower().startswith(_LABEL_COMENTION_PREFIX)


def _meddata_has_signal(meddata_row: dict[str, Any] | None) -> bool:
    if not meddata_row:
        return False
    desc = (meddata_row.get("description") or "").strip()
    sev = (meddata_row.get("severity") or "").strip()
    return bool(desc or sev)


def build_pair_summary(
    name_a: str,
    name_b: str,
    meddata_row: dict[str, Any] | None,
    suppai_source: dict[str, Any] | None,
    openfda_evidence: str,
) -> tuple[str, str, str]:
    """Return (severity, summary, full_text) without LLM."""
    severity = "unknown"
    if meddata_row:
        severity = map_meddata_severity(meddata_row.get("severity"))

    summary_parts: list[str] = []
    full_sections: list[str] = []

    if meddata_row:
        desc = meddata_row.get("description") or (
            f"Interaction data was found for {name_a} and {name_b}."
        )
        if _is_label_comention(desc):
            # These rows are "both names appear in the same FDA label section".
            # The raw text is a truncated ingredient list and is unreadable on a
            # card, so summarise it and keep the excerpt for the detail page.
            summary_parts.append(
                f"{primary_lookup_name(name_a)} and {primary_lookup_name(name_b)} are "
                "listed together in the US FDA drug label interactions section. "
                "Check with your pharmacist or GP whether it applies to you."
            )
        else:
            summary_parts.append(desc)
        full_sections.append(f"What we found (MedData)\n{desc}")
        src = meddata_row.get("source")
        if src:
            full_sections.append(f"MedData citation\n{src}")

    if suppai_source:
        evidence = suppai_source.get("evidence") or []
        lead = evidence[0].get("sentence", "") if evidence else ""
        if lead and not meddata_row:
            # Evidence sentences are lifted from paper abstracts and read badly
            # on their own, so give the card a plain-language opening line.
            summary_parts.append(
                f"Published research reports a possible interaction between "
                f"{primary_lookup_name(name_a)} and {primary_lookup_name(name_b)}."
            )
        if lead:
            summary_parts.append(lead)
        ev_lines = []
        for ev in evidence:
            line = ev.get("sentence", "")
            title = ev.get("paper_title")
            year = ev.get("paper_year")
            cite = f" ({title}, {year})" if title and year else ""
            ev_lines.append(f"- {line}{cite}")
        if ev_lines:
            full_sections.append(
                "What we found (Supp.AI literature)\n" + "\n".join(ev_lines)
            )
        if severity == "unknown":
            severity = "moderate"

    if openfda_evidence:
        excerpt = openfda_evidence[:1200].strip()
        if excerpt:
            summary_parts.append(
                "US FDA label text may mention this combination; see full detail."
            )
            full_sections.append(f"US FDA label excerpt\n{excerpt}")

    if not summary_parts:
        summary_parts.append(
            f"Possible interaction signal for {name_a} and {name_b}. "
            "Review the sources below and discuss with a pharmacist or GP."
        )

    summary = " ".join(summary_parts[:3])
    if not summary.endswith("."):
        summary = f"{summary} Discuss with a medical professional."

    # DISCLAIMER is appended by the caller and already says to discuss with a
    # pharmacist or GP, so no extra closing line here.
    full_text = "\n\n".join(full_sections) if full_sections else summary

    has_signal = bool(meddata_row or suppai_source or openfda_evidence)
    if has_signal and severity == "none":
        severity = "low"

    return severity, summary, full_text


async def _resolve_suppai_agents(meds: list[Medication]) -> dict[int, dict[str, Any]]:
    """One agent search per medication instead of one per pair."""
    sem = asyncio.Semaphore(_SUPPAI_CONCURRENCY)

    async def one(med: Medication):
        async with sem:
            try:
                return med.id, await search_agent(med.display_name)
            except Exception as e:  # network noise must not fail the whole check
                log.warning("Supp.AI agent lookup failed for %s: %s", med.display_name, e)
                return med.id, None

    pairs = await asyncio.gather(*(one(m) for m in meds))
    return {mid: agent for mid, agent in pairs if agent}


async def check_interactions_for_user(
    db: Session,
    user_id: str,
    medication_ids: list[int] | None = None,
    *,
    meddata_only: bool = False,
) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """Check every active pair. Returns (warnings, per-source status).

    The status map is what stops an API outage from rendering as "no
    interactions found" in the app.
    """
    q = db.query(Medication).filter(
        Medication.user_id == user_id,
        Medication.archived_at.is_(None),
    )
    if medication_ids:
        q = q.filter(Medication.id.in_(medication_ids))
    meds = q.all()

    sources: dict[str, str] = {"meddata": "ok", "suppai": "skipped"}
    if len(meds) < 2:
        return [], sources

    meddata: MedDataResult = await check_unified_interactions(
        [m.display_name for m in meds]
    )
    sources["meddata"] = meddata.status
    if meddata.detail and meddata.detail != "cache":
        sources["meddata_detail"] = meddata.detail
    log.info(
        "MedData check: status=%s rows=%d requests=%d",
        meddata.status,
        len(meddata.rows),
        meddata.requests_made,
    )

    pairs = list(itertools.combinations(meds, 2))
    meddata_rows = {
        (a.id, b.id): find_pair_interaction(meddata.data, a.display_name, b.display_name)
        for a, b in pairs
    }

    suppai_sources: dict[tuple[int, int], dict[str, Any]] = {}
    if not meddata_only:
        agents = await _resolve_suppai_agents(meds)
        # Supp.AI only holds supplement/drug pairs, so skip the rest entirely.
        candidates = [
            (a, b)
            for a, b in pairs
            if meddata_rows.get((a.id, b.id)) is None
            and (is_supplement(agents.get(a.id)) or is_supplement(agents.get(b.id)))
        ]
        if candidates:
            sem = asyncio.Semaphore(_SUPPAI_CONCURRENCY)

            async def one(a: Medication, b: Medication):
                async with sem:
                    try:
                        _, source = await check_pair_suppai(
                            a.display_name,
                            b.display_name,
                            agents.get(a.id),
                            agents.get(b.id),
                        )
                        return (a.id, b.id), source
                    except Exception as e:
                        log.warning("Supp.AI pair lookup failed: %s", e)
                        return (a.id, b.id), None

            results = await asyncio.gather(*(one(a, b) for a, b in candidates))
            suppai_sources = {k: v for k, v in results if v}
            sources["suppai"] = "ok"

    warnings: list[dict[str, Any]] = []
    for a, b in pairs:
        meddata_row = meddata_rows.get((a.id, b.id))
        suppai_source = suppai_sources.get((a.id, b.id))
        if not _meddata_has_signal(meddata_row) and not suppai_source:
            continue

        severity, summary, full_text = build_pair_summary(
            a.display_name, b.display_name, meddata_row, suppai_source, ""
        )
        source_rows: list[dict[str, Any]] = []
        if meddata_row:
            source_rows.append(meddata_source_entry(meddata_row))
        if suppai_source:
            source_rows.append(suppai_source)

        rec = _upsert_record(
            db,
            user_id=user_id,
            med_a_id=a.id,
            med_b_id=b.id,
            severity=severity,
            summary=summary,
            full_text=f"{full_text}\n\n{DISCLAIMER}",
            sources=sources_json(source_rows),
        )
        warnings.append(
            {
                "interaction_id": rec.id,
                "med_a": {"id": a.id, "display_name": a.display_name},
                "med_b": {"id": b.id, "display_name": b.display_name},
                "severity": rec.severity,
                "summary": rec.summary,
                "source": "meddata" if meddata_row else "suppai",
            }
        )

    db.commit()
    return warnings, sources


def _upsert_record(
    db: Session,
    *,
    user_id: str,
    med_a_id: int,
    med_b_id: int,
    severity: str,
    summary: str,
    full_text: str,
    sources: str,
) -> InteractionRecord:
    """One row per (user, pair). Previously every check inserted duplicates."""
    rec = (
        db.query(InteractionRecord)
        .filter(
            InteractionRecord.user_id == user_id,
            InteractionRecord.med_a_id == med_a_id,
            InteractionRecord.med_b_id == med_b_id,
        )
        .first()
    )
    if rec is None:
        rec = InteractionRecord(
            user_id=user_id,
            med_a_id=med_a_id,
            med_b_id=med_b_id,
            severity=severity,
            summary=summary,
            full_text=full_text,
            sources=sources,
        )
        db.add(rec)
    else:
        rec.severity = severity
        rec.summary = summary
        rec.full_text = full_text
        rec.sources = sources
    db.flush()
    return rec


def get_interaction_detail(db: Session, interaction_id: int, user_id: str) -> dict | None:
    rec = (
        db.query(InteractionRecord)
        .filter(
            InteractionRecord.id == interaction_id,
            InteractionRecord.user_id == user_id,
        )
        .first()
    )
    if not rec:
        return None
    return {
        "interaction_id": rec.id,
        "severity": rec.severity,
        "summary": rec.summary,
        "full_text": rec.full_text,
        "sources": json.loads(rec.sources or "[]"),
        "med_a": {"id": rec.med_a_id, "display_name": rec.med_a.display_name},
        "med_b": {"id": rec.med_b_id, "display_name": rec.med_b.display_name},
        "disclaimer": DISCLAIMER,
    }
