import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.models import MedCategory, Medication, get_db

router = APIRouter(prefix="/medications", tags=["medications"])


def get_user_id(x_user_id: str | None = Header(default=None, alias="X-User-Id")) -> str:
    return x_user_id or "demo"


class MedicationCreate(BaseModel):
    display_name: str
    category: MedCategory
    dosage: str
    schedule: dict[str, Any] = Field(default_factory=dict)
    started_at: datetime | None = None
    dmd_code: str | None = None
    dmd_code_type: str | None = None
    gtin: str | None = None


class MedicationUpdate(BaseModel):
    dosage: str | None = None
    schedule: dict[str, Any] | None = None
    category: MedCategory | None = None
    started_at: datetime | None = None
    archive: bool | None = None


class MedicationOut(BaseModel):
    id: int
    user_id: str
    display_name: str
    category: MedCategory
    dosage: str
    schedule: dict[str, Any]
    started_at: datetime | None
    archived_at: datetime | None
    dmd_code: str | None
    dmd_code_type: str | None
    gtin: str | None

    model_config = {"from_attributes": True}


def _med_to_out(m: Medication) -> MedicationOut:
    try:
        sched = json.loads(m.schedule) if m.schedule else {}
    except json.JSONDecodeError:
        sched = {}
    return MedicationOut(
        id=m.id,
        user_id=m.user_id,
        display_name=m.display_name,
        category=m.category,
        dosage=m.dosage,
        schedule=sched,
        started_at=m.started_at,
        archived_at=m.archived_at,
        dmd_code=m.dmd_code,
        dmd_code_type=m.dmd_code_type,
        gtin=m.gtin,
    )


@router.post("", response_model=MedicationOut, status_code=201)
def create_medication(
    body: MedicationCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id),
):
    med = Medication(
        user_id=user_id,
        display_name=body.display_name,
        category=body.category,
        dosage=body.dosage,
        schedule=json.dumps(body.schedule),
        started_at=body.started_at or datetime.utcnow(),
        dmd_code=body.dmd_code,
        dmd_code_type=body.dmd_code_type,
        gtin=body.gtin,
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    return _med_to_out(med)


@router.get("", response_model=list[MedicationOut])
def list_medications(
    status: str = Query("active", pattern="^(active|archived|all)$"),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id),
):
    q = db.query(Medication).filter(Medication.user_id == user_id)
    if status == "active":
        q = q.filter(Medication.archived_at.is_(None))
    elif status == "archived":
        q = q.filter(Medication.archived_at.isnot(None))
    meds = q.order_by(Medication.created_at.desc()).all()
    return [_med_to_out(m) for m in meds]


@router.patch("/{med_id}", response_model=MedicationOut)
def update_medication(
    med_id: int,
    body: MedicationUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id),
):
    med = (
        db.query(Medication)
        .filter(Medication.id == med_id, Medication.user_id == user_id)
        .first()
    )
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    if body.dosage is not None:
        med.dosage = body.dosage
    if body.schedule is not None:
        med.schedule = json.dumps(body.schedule)
    if body.category is not None:
        med.category = body.category
    if body.started_at is not None:
        med.started_at = body.started_at
    if body.archive is True:
        med.archived_at = datetime.utcnow()
    elif body.archive is False:
        med.archived_at = None
    db.commit()
    db.refresh(med)
    return _med_to_out(med)


@router.delete("/{med_id}", status_code=204)
def delete_medication(
    med_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id),
):
    med = (
        db.query(Medication)
        .filter(Medication.id == med_id, Medication.user_id == user_id)
        .first()
    )
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    db.delete(med)
    db.commit()
