#!/usr/bin/env python3
"""Create or update Render web service + env vars from backend/.env (requires RENDER_API_KEY)."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / "backend" / ".env"

RENDER_KEYS = (
    "MEDDATA_API_KEY",
    "MEDDATA_BASE_URL",
    "OPENFDA_API_KEY",
    "TRUD_API_KEY",
    "TRUD_DMD_ITEM_ID",
    "APP_DATABASE_URL",
    "GP_TOKEN_TTL_HOURS",
)


def load_dotenv(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip()
    return out


def api(method: str, path: str, body: dict | None = None) -> dict:
    key = os.environ.get("RENDER_API_KEY") or load_dotenv(ENV_FILE).get("RENDER_API_KEY", "")
    if not key:
        print("Set RENDER_API_KEY in the environment or backend/.env", file=sys.stderr)
        sys.exit(1)
    url = f"https://api.render.com/v1{path}"
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        print(f"Render API {method} {path} failed ({e.code}): {err}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    dot = load_dotenv(ENV_FILE)
    owner_id = os.environ.get("RENDER_OWNER_ID", "")
    if not owner_id:
        print("Set RENDER_OWNER_ID to your Render owner id (dashboard → Account Settings).", file=sys.stderr)
        sys.exit(1)

    repo = "https://github.com/dthwwydfli/juno-hackathon"
    service_name = "pocketary-api"

    create_body = {
        "type": "web_service",
        "name": service_name,
        "ownerId": owner_id,
        "repo": repo,
        "branch": "main",
        "rootDir": "backend",
        "runtime": "docker",
        "plan": "free",
        "region": "frankfurt",
        "healthCheckPath": "/health",
        "envVars": [
            {"key": "SEED_DEMO_ON_START", "value": "1"},
            {
                "key": "CORS_ORIGINS",
                "value": "https://pocketary.vercel.app,http://localhost:5173",
            },
            {"key": "DMD_DB_PATH", "value": "/app/data/dmd.sqlite"},
            {"key": "APP_DB_PATH", "value": "/app/data/app.sqlite"},
            {"key": "MEDDATA_BASE_URL", "value": dot.get("MEDDATA_BASE_URL", "https://meddata.anthesia.io")},
        ],
    }
    for k in RENDER_KEYS:
        if dot.get(k):
            create_body["envVars"].append({"key": k, "value": dot[k]})

    print(f"Creating Render service {service_name} from {repo} (main/backend)…")
    created = api("POST", "/services", create_body)
    service = created.get("service") or created
    service_id = service.get("id") or service.get("service", {}).get("id")
    url = service.get("serviceDetails", {}).get("url") or service.get("url")
    if not url and service_id:
        detail = api("GET", f"/services/{service_id}")
        url = (detail.get("serviceDetails") or {}).get("url") or detail.get("url")

    if not url:
        print(json.dumps(created, indent=2))
        print("Service created; fetch URL from Render dashboard.", file=sys.stderr)
        sys.exit(0)

    url = url.rstrip("/")
    api("PUT", f"/services/{service_id}/env-vars/PUBLIC_BASE_URL", {"value": url})
    print(f"Render service URL: {url}")
    print(f"Run: backend/scripts/sync_vercel_api_url.sh {url}")


if __name__ == "__main__":
    main()
