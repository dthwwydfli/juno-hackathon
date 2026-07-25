from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.dmd.lookup import lookup_by_code

router = APIRouter(prefix="/lookup", tags=["lookup"])


class BarcodeLookupRequest(BaseModel):
    code: str = Field(..., min_length=1)
    code_type: Literal["gtin", "pack", "product"] = "gtin"


@router.post("/barcode")
def lookup_barcode_post(body: BarcodeLookupRequest):
    result = lookup_by_code(body.code, body.code_type)
    if not result:
        raise HTTPException(status_code=404, detail="Code not found in dm+d database")
    return result


@router.get("/barcode")
def lookup_barcode_get(
    code: str = Query(...),
    code_type: Literal["gtin", "pack", "product"] = "gtin",
):
    result = lookup_by_code(code, code_type)
    if not result:
        raise HTTPException(status_code=404, detail="Code not found in dm+d database")
    return result
