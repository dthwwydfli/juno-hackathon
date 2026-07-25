from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.models import get_db
from app.routers.medications import get_user_id
from app.services.interactions import check_interactions_for_user, get_interaction_detail

router = APIRouter(prefix="/interactions", tags=["interactions"])


class InteractionCheckRequest(BaseModel):
    medication_ids: list[int] | None = None
    meddata_only: bool = Field(default=False)


@router.post("/check")
async def check_interactions(
    body: InteractionCheckRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id),
):
    warnings, sources = await check_interactions_for_user(
        db,
        user_id,
        body.medication_ids,
        meddata_only=body.meddata_only,
    )
    return {
        "warnings": warnings,
        "count": len(warnings),
        "sources_status": sources,
    }


@router.get("/{interaction_id}")
def interaction_detail(
    interaction_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id),
):
    detail = get_interaction_detail(db, interaction_id, user_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return detail
