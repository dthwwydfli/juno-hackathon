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
    "APP_DATABASE_URL",
    "GP_TOKEN_TTL_HOURS",
)
# TRUD_* omitted on Render — full dm+d sync on startup exceeds free-tier 512Mi RAM.


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


def api_key() -> str:
    dot = load_dotenv(ENV_FILE)
    key = os.environ.get("RENDER_API_KEY") or dot.get("RENDER_API_KEY", "")
    if not key:
        print("Set RENDER_API_KEY in the environment or backend/.env", file=sys.stderr)
        sys.exit(1)
    return key


def api(method: str, path: str, body: dict | None = None) -> dict:
    url = f"https://api.render.com/v1{path}"
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {api_key()}",
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
        if method == "DELETE" and e.code == 404:
            return {}
        print(f"Render API {method} {path} failed ({e.code}): {err}", file=sys.stderr)
        sys.exit(1)


def service_url(service: dict) -> str | None:
    details = service.get("serviceDetails") or {}
    url = details.get("url") or service.get("url")
    return url.rstrip("/") if url else None


def env_var_payload(dot: dict[str, str]) -> list[dict]:
    env: list[dict] = [
        {"key": "SEED_DEMO_ON_START", "value": "0"},
        {"key": "CORS_ORIGINS", "value": "https://pocketary.vercel.app,http://localhost:5173"},
        {"key": "DMD_DB_PATH", "value": "/app/data/dmd.sqlite"},
        {"key": "APP_DB_PATH", "value": "/app/data/app.sqlite"},
        {
            "key": "MEDDATA_BASE_URL",
            "value": dot.get("MEDDATA_BASE_URL", "https://meddata.anthesia.io"),
        },
    ]
    for k in RENDER_KEYS:
        if k == "APP_DATABASE_URL":
            url = dot.get(k, "").strip()
            if not url or "127.0.0.1" in url or "localhost" in url:
                continue
            env.append({"key": k, "value": url})
            continue
        if dot.get(k):
            env.append({"key": k, "value": dot[k]})
    return env


def remove_render_env(service_id: str, key: str) -> None:
    try:
        api("DELETE", f"/services/{service_id}/env-vars/{key}")
    except SystemExit:
        pass


def sync_env_vars(service_id: str, dot: dict[str, str], public_url: str) -> None:
    for item in env_var_payload(dot):
        api("PUT", f"/services/{service_id}/env-vars/{item['key']}", {"value": item["value"]})
    api("PUT", f"/services/{service_id}/env-vars/PUBLIC_BASE_URL", {"value": public_url})


def trigger_deploy(service_id: str) -> None:
    api("POST", f"/services/{service_id}/deploys", {"clearCache": "do_not_clear"})


def resolve_owner_id(dot: dict[str, str]) -> str:
    raw = os.environ.get("RENDER_OWNER_ID") or dot.get("RENDER_OWNER_ID", "")
    if raw.startswith(("usr-", "tea-")):
        return raw
    return ""


def main() -> None:
    dot = load_dotenv(ENV_FILE)
    raw_id = os.environ.get("RENDER_OWNER_ID") or dot.get("RENDER_OWNER_ID", "")

    if raw_id.startswith("srv-"):
        print(f"Using existing Render service {raw_id}…")
        detail = api("GET", f"/services/{raw_id}")
        service = detail.get("service") or detail
        service_id = service.get("id") or raw_id
        url = service_url(service)
        if not url:
            print(json.dumps(detail, indent=2))
            sys.exit(1)
        sync_env_vars(service_id, dot, url)
        remove_render_env(service_id, "APP_DATABASE_URL")
        remove_render_env(service_id, "TRUD_API_KEY")
        remove_render_env(service_id, "TRUD_DMD_ITEM_ID")
        trigger_deploy(service_id)
        print(f"Render service URL: {url}")
        print(f"Run: backend/scripts/sync_vercel_api_url.sh {url}")
        return

    owner_id = resolve_owner_id(dot)
    if not owner_id:
        print(
            "Set RENDER_OWNER_ID to usr-… or tea-… (Account Settings), "
            "or an existing srv-… service id.",
            file=sys.stderr,
        )
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
        "envVars": env_var_payload(dot),
    }

    print(f"Creating Render service {service_name} from {repo} (main/backend)…")
    created = api("POST", "/services", create_body)
    service = created.get("service") or created
    service_id = service.get("id")
    url = service_url(service)
    if not url and service_id:
        detail = api("GET", f"/services/{service_id}")
        service = detail.get("service") or detail
        url = service_url(service)

    if not service_id or not url:
        print(json.dumps(created, indent=2))
        sys.exit(1)

    api("PUT", f"/services/{service_id}/env-vars/PUBLIC_BASE_URL", {"value": url})
    print(f"Render service URL: {url}")
    print(f"Run: backend/scripts/sync_vercel_api_url.sh {url}")


if __name__ == "__main__":
    main()
