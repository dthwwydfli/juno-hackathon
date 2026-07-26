#!/usr/bin/env bash
# Smoke-test API reachability before scanning on a phone (same checks as deploy doc).
set -euo pipefail
API="${1:-${VITE_API_BASE_URL:-http://127.0.0.1:8000}}"
API="${API%/}"
echo "Checking ${API}/health …"
curl -sf "${API}/health" | python3 -m json.tool
echo ""
echo "Sample barcode lookup (404 = API reachable, code may not be in your dm+d DB):"
curl -s "${API}/lookup/barcode?code=5012345678901" | python3 -m json.tool || true
echo ""
echo "Phone checklist:"
echo "  1. Open ${API}/health in mobile Safari/Chrome"
echo "  2. Open Vercel app → Add → Camera → scan pack barcode"
echo "  3. Or Manual tab → GTIN → Lookup"
