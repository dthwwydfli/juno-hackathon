import json
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import GpShareToken, InteractionRecord, Medication, get_db
from app.routers.medications import get_user_id
from app.schemas.gp_snapshot import GpShareSnapshot
from app.services.demo_seed import DEMO_USER_ID, seed_demo_cabinet
from app.services.gp_summary import format_gp_interaction_line
from app.services.pdf import build_gp_pdf, build_gp_pdf_from_snapshot
from app.time_util import as_utc_aware, utc_now

router = APIRouter(prefix="/gp", tags=["gp"])


class ShareTokenRequest(BaseModel):
    patient_label: str | None = None
    snapshot: GpShareSnapshot | None = None


class ShareTokenResponse(BaseModel):
    token: str
    expires_at: datetime
    pdf_url: str
    qr_url: str


def _validate_token(db: Session, token: str) -> GpShareToken:
    row = db.query(GpShareToken).filter(GpShareToken.token == token).first()
    if not row:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
    if as_utc_aware(row.expires_at) < utc_now():
        raise HTTPException(status_code=410, detail="Share link expired")
    return row


def _snapshot_json(body: ShareTokenRequest) -> str | None:
    if not body.snapshot:
        return None
    return body.snapshot.model_dump_json(by_alias=True)


@router.post("/share-token", response_model=ShareTokenResponse)
def create_share_token(
    body: ShareTokenRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id),
):
    token = secrets.token_urlsafe(32)
    expires = utc_now() + timedelta(hours=settings.gp_token_ttl_hours)
    row = GpShareToken(
        token=token,
        user_id=user_id,
        patient_label=body.patient_label or (body.snapshot.profile.name if body.snapshot else None),
        snapshot_json=_snapshot_json(body),
        expires_at=expires,
    )
    db.add(row)
    db.commit()
    base = settings.public_base_url.rstrip("/")
    pdf_url = f"{base}/gp/summary/{token}.pdf"
    return ShareTokenResponse(
        token=token,
        expires_at=expires,
        pdf_url=pdf_url,
        qr_url=pdf_url,
    )


@router.post("/demo-share", response_model=ShareTokenResponse)
def create_demo_share(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id),
):
    if user_id != DEMO_USER_ID:
        raise HTTPException(
            status_code=403,
            detail="Demo share is only available for the demo user",
        )
    seed_demo_cabinet(db, user_id=user_id)
    return create_share_token(
        ShareTokenRequest(patient_label="Demo patient (mock)"),
        db=db,
        user_id=user_id,
    )


def _summary_payload(db: Session, user_id: str, patient_label: str | None):
    active = (
        db.query(Medication)
        .filter(Medication.user_id == user_id, Medication.archived_at.is_(None))
        .all()
    )
    archived = (
        db.query(Medication)
        .filter(Medication.user_id == user_id, Medication.archived_at.isnot(None))
        .all()
    )
    ix = (
        db.query(InteractionRecord)
        .filter(InteractionRecord.user_id == user_id)
        .order_by(InteractionRecord.created_at.desc())
        .limit(5)
        .all()
    )
    highlights = [format_gp_interaction_line(r) for r in ix]
    return active, archived, highlights, patient_label


def _pdf_bytes_for_token(row: GpShareToken, db: Session) -> bytes:
    if row.snapshot_json:
        snapshot = GpShareSnapshot.model_validate_json(row.snapshot_json)
        return build_gp_pdf_from_snapshot(snapshot)
    active, archived, highlights, label = _summary_payload(
        db, row.user_id, row.patient_label
    )
    return build_gp_pdf(label, active, archived, highlights, expires_at=row.expires_at)


@router.get("/summary/{token}.pdf")
def summary_pdf(token: str, db: Session = Depends(get_db)):
    row = _validate_token(db, token)
    pdf_bytes = _pdf_bytes_for_token(row, db)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="medication-summary.pdf"'
        },
    )


@router.get("/summary/{token}")
def summary_json(token: str, db: Session = Depends(get_db)):
    row = _validate_token(db, token)
    if row.snapshot_json:
        snapshot = GpShareSnapshot.model_validate_json(row.snapshot_json)
        active = [m for m in snapshot.medications if m.status == "active"]
        archived = [m for m in snapshot.medications if m.status == "archived"]
        return {
            "patient_label": snapshot.profile.name,
            "last_synced": snapshot.last_synced,
            "active": [
                {
                    "display_name": f"{m.name} {m.dose}".strip(),
                    "category": m.category,
                    "dosage": m.dose,
                }
                for m in active
            ],
            "archived": [
                {
                    "display_name": f"{m.name} {m.dose}".strip(),
                }
                for m in archived
            ],
            "interaction_highlights": [
                f"{i.a} + {i.b}: {i.reason}" for i in snapshot.interactions
            ],
            "snapshot": json.loads(row.snapshot_json),
        }
    active, archived, highlights, label = _summary_payload(
        db, row.user_id, row.patient_label
    )
    return {
        "patient_label": label,
        "active": [
            {
                "display_name": m.display_name,
                "category": m.category.value,
                "dosage": m.dosage,
                "started_at": m.started_at.isoformat() if m.started_at else None,
            }
            for m in active
        ],
        "archived": [
            {
                "display_name": m.display_name,
                "started_at": m.started_at.isoformat() if m.started_at else None,
                "archived_at": m.archived_at.isoformat() if m.archived_at else None,
            }
            for m in archived
        ],
        "interaction_highlights": highlights,
    }
