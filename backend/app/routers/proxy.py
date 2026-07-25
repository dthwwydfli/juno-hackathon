from fastapi import APIRouter, HTTPException, Query

from app.services.meddata import check_unified_interactions

router = APIRouter(prefix="/proxy/meddata", tags=["proxy"])


@router.get("/interactions/check")
async def proxy_meddata_interactions_check(items: str = Query(..., min_length=1)):
    """Forward MedData interaction check so the browser never holds the API key."""
    names = [n.strip() for n in items.split(",") if n.strip()]
    if len(names) < 2:
        raise HTTPException(status_code=400, detail="At least two item names required")
    result = await check_unified_interactions(names[:10])
    if result is None:
        return {"interactions": [], "unavailable": True}
    return result
