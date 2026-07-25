"""Download NHS dm+d from TRUD and ingest into SQLite for barcode lookup."""

from __future__ import annotations

import io
import re
import sqlite3
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import httpx

SAMPLE_DB_ROW_THRESHOLD = 3

SCHEMA = """
DROP TABLE IF EXISTS gtin_lookup;
CREATE TABLE gtin_lookup (
    gtin TEXT NOT NULL,
    ampp_code TEXT NOT NULL,
    vmp_code TEXT,
    display_name TEXT NOT NULL,
    form TEXT,
    strength TEXT,
    vtm_name TEXT
);
CREATE INDEX idx_gtin ON gtin_lookup(gtin);
CREATE INDEX idx_ampp ON gtin_lookup(ampp_code);
CREATE INDEX idx_vmp ON gtin_lookup(vmp_code);
"""


def _local(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def _text(el: ET.Element | None) -> str:
    return (el.text or "").strip() if el is not None else ""


def parse_vtm(xml_bytes: bytes) -> dict[str, str]:
    root = ET.fromstring(xml_bytes)
    out: dict[str, str] = {}
    for vtm in root.iter():
        if _local(vtm.tag) != "VTM":
            continue
        vid = None
        name = None
        for child in vtm:
            ln = _local(child.tag)
            if ln == "VTMID":
                vid = _text(child)
            elif ln in ("NM", "NAME", "DESC"):
                name = _text(child) or name
        if vid and name:
            out[vid] = name
    return out


def parse_vmp(xml_bytes: bytes, vtms: dict[str, str]) -> dict[str, dict]:
    root = ET.fromstring(xml_bytes)
    out: dict[str, dict] = {}
    for vmp in root.iter():
        if _local(vmp.tag) != "VMP":
            continue
        vid = None
        vtmid = None
        nm = None
        form = None
        strength = None
        for child in vmp:
            ln = _local(child.tag)
            if ln == "VPID":
                vid = _text(child)
            elif ln == "VTMID":
                vtmid = _text(child)
            elif ln in ("NM", "NMMT", "DESC"):
                nm = _text(child) or nm
            elif ln == "FORM":
                form = _text(child) or form
            elif ln in ("STRNT", "STRENGTH"):
                strength = _text(child) or strength
        if vid:
            out[vid] = {
                "display_name": nm or vtms.get(vtmid or "", "Unknown VMP"),
                "form": form or "",
                "strength": strength or "",
                "vtm_name": vtms.get(vtmid or "", ""),
                "vmp_code": vid,
            }
    return out


def parse_ampp(xml_bytes: bytes) -> dict[str, dict]:
    root = ET.fromstring(xml_bytes)
    out: dict[str, dict] = {}
    for ampp in root.iter():
        if _local(ampp.tag) != "AMPP":
            continue
        apid = None
        vpid = None
        nm = None
        for child in ampp:
            ln = _local(child.tag)
            if ln == "APPID":
                apid = _text(child)
            elif ln == "VPID":
                vpid = _text(child)
            elif ln in ("NM", "DESC"):
                nm = _text(child) or nm
        if apid:
            out[apid] = {"vmp_code": vpid or "", "display_name": nm or ""}
    return out


def parse_gtin(xml_bytes: bytes) -> list[tuple[str, str]]:
    root = ET.fromstring(xml_bytes)
    pairs: list[tuple[str, str]] = []
    for node in root.iter():
        ln = _local(node.tag)
        if ln == "AMPP":
            ampp = None
            gtins: list[str] = []
            for child in node:
                cl = _local(child.tag)
                if cl in ("APPID", "AMPPID"):
                    ampp = _text(child) or ampp
                elif cl == "GTINDATA":
                    for sub in child:
                        if _local(sub.tag) in ("GTIN", "GTINID"):
                            gt = _text(sub)
                            if gt:
                                gtins.append(gt)
                elif cl in ("GTIN", "GTINID"):
                    gt = _text(child)
                    if gt:
                        gtins.append(gt)
            if ampp:
                for gtin in gtins:
                    pairs.append((gtin, ampp))
            continue
        if ln not in ("GTIN", "GTINDetail", "AMPPGTIN"):
            continue
        gtin = None
        ampp = None
        for child in node:
            cl = _local(child.tag)
            if cl in ("GTIN", "GTINID", "CD"):
                gtin = _text(child) or gtin
            elif cl in ("APPID", "AMPPID", "AMPP"):
                ampp = _text(child) or ampp
        if not gtin:
            for child in node.iter():
                cl = _local(child.tag)
                if cl in ("GTIN", "GTINID") and not gtin:
                    gtin = _text(child)
                if cl in ("APPID", "AMPPID") and not ampp:
                    ampp = _text(child)
        if gtin and ampp:
            pairs.append((gtin, ampp))
    return pairs


def find_member(zf: zipfile.ZipFile, pattern: str) -> str | None:
    rx = re.compile(pattern, re.I)
    for name in zf.namelist():
        if rx.search(name) and name.lower().endswith(".xml"):
            return name
    return None


def read_gtin_xml(zf: zipfile.ZipFile) -> bytes:
    gtin_name = find_member(zf, r"gtin")
    if gtin_name:
        return zf.read(gtin_name)
    for name in zf.namelist():
        if "gtin" in name.lower() and name.lower().endswith(".zip"):
            inner = zipfile.ZipFile(io.BytesIO(zf.read(name)))
            gtin_name = find_member(inner, r"gtin")
            if gtin_name:
                return inner.read(gtin_name)
    raise ValueError("Could not find f_gtin*.xml in zip (or nested GTIN zip)")


def ingest_zip(zip_path: Path, out_path: Path) -> int:
    with zipfile.ZipFile(zip_path) as zf:
        ampp_name = find_member(zf, r"ampp")
        vmp_name = find_member(zf, r"vmp")
        vtm_name = find_member(zf, r"vtm")

        vtms = parse_vtm(zf.read(vtm_name)) if vtm_name else {}
        vmps = parse_vmp(zf.read(vmp_name), vtms) if vmp_name else {}
        ampps = parse_ampp(zf.read(ampp_name)) if ampp_name else {}
        gtin_pairs = parse_gtin(read_gtin_xml(zf))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(out_path)
    conn.executescript(SCHEMA)
    count = 0
    for gtin, ampp_code in gtin_pairs:
        ampp = ampps.get(ampp_code, {})
        vmp_code = ampp.get("vmp_code", "")
        vmp = vmps.get(vmp_code, {})
        display = ampp.get("display_name") or vmp.get("display_name") or ampp_code
        conn.execute(
            """
            INSERT INTO gtin_lookup
            (gtin, ampp_code, vmp_code, display_name, form, strength, vtm_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                gtin,
                ampp_code,
                vmp_code,
                display,
                vmp.get("form", ""),
                vmp.get("strength", ""),
                vmp.get("vtm_name", ""),
            ),
        )
        count += 1

    for ampp_code, ampp in ampps.items():
        vmp_code = ampp.get("vmp_code", "")
        vmp = vmps.get(vmp_code, {})
        display = ampp.get("display_name") or vmp.get("display_name") or ampp_code
        conn.execute(
            """
            INSERT OR IGNORE INTO gtin_lookup
            (gtin, ampp_code, vmp_code, display_name, form, strength, vtm_name)
            VALUES ('', ?, ?, ?, ?, ?, ?)
            """,
            (
                ampp_code,
                vmp_code,
                display,
                vmp.get("form", ""),
                vmp.get("strength", ""),
                vmp.get("vtm_name", ""),
            ),
        )

    conn.commit()
    conn.close()
    return count


def download_trud(item_id: str, api_key: str) -> bytes:
    list_url = (
        f"https://isd.digital.nhs.uk/trud/api/v1/keys/{api_key}"
        f"/items/{item_id}/releases?latest"
    )
    with httpx.Client(timeout=120.0, follow_redirects=True) as client:
        rel = client.get(list_url)
        rel.raise_for_status()
        releases = rel.json().get("releases") or []
        if not releases:
            raise ValueError("No releases found for TRUD item")
        latest = releases[0]
        archive_url = latest.get("archiveFileUrl") or latest.get("fileUrl")
        if not archive_url:
            raise ValueError("Release has no download URL")
        data = client.get(archive_url)
        data.raise_for_status()
        return data.content


def gtin_lookup_count(db_path: Path) -> int:
    if not db_path.exists():
        return 0
    conn = sqlite3.connect(db_path)
    try:
        row = conn.execute("SELECT COUNT(*) FROM gtin_lookup").fetchone()
        return int(row[0]) if row else 0
    except sqlite3.Error:
        return 0
    finally:
        conn.close()


def sync_dmd_from_trud(out_path: Path, item_id: str, api_key: str) -> int:
    blob = download_trud(item_id.strip(), api_key.strip())
    tmp = out_path.parent / "_trud_download.zip"
    try:
        tmp.write_bytes(blob)
        return ingest_zip(tmp, out_path)
    finally:
        tmp.unlink(missing_ok=True)
