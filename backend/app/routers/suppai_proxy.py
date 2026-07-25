from fastapi import APIRouter, Query

from app.services.suppai import check_pair_suppai

router = APIRouter(prefix="/proxy/suppai", tags=["proxy"])


@router.get("/pair")
async def proxy_suppai_pair(
    a: str = Query(..., min_length=1),
    b: str = Query(..., min_length=1),
):
    """Forward Supp.AI pair lookup so the browser avoids direct rate limits."""
    _interaction, entry = await check_pair_suppai(a.strip(), b.strip())
    if not entry:
        return {"found": False}
    evidence = entry.get("evidence") or []
    lead = ""
    if evidence and isinstance(evidence[0], dict):
        lead = str(evidence[0].get("sentence") or "").strip()
    if not lead and evidence:
        lead = f"Possible interaction between {a} and {b} (literature source)."
    return {
        "found": True,
        "lead": lead,
        "evidence": evidence,
    }
