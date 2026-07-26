#!/usr/bin/env bash
# Run API reachable from phones on the same LAN (bind all interfaces).
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -d .venv ]]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
fi
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --app-dir .
