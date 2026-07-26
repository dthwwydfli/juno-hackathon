#!/usr/bin/env bash
# Point pocketary.vercel.app at a public HTTPS API and redeploy (VITE_* are build-time).
set -euo pipefail
API_URL="${1:?Usage: $0 https://your-api.example.com}"
API_URL="${API_URL%/}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/backend/.env"

cd "$ROOT/frontend"
printf '%s' "$API_URL" | vercel env add VITE_API_BASE_URL production --force
printf '%s' "$API_URL" | vercel env add VITE_API_BASE_URL preview --force
printf '%s' "demo" | vercel env add VITE_USER_ID production --force 2>/dev/null || true
printf '%s' "https://pocketary.vercel.app" | vercel env add VITE_PUBLIC_APP_ORIGIN production --force 2>/dev/null || true

vercel --prod --yes

if [[ -f "$ENV_FILE" ]] && grep -q '^PUBLIC_BASE_URL=' "$ENV_FILE"; then
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=${API_URL}|" "$ENV_FILE"
  else
    sed -i '' "s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=${API_URL}|" "$ENV_FILE"
  fi
fi

echo "Vercel production redeploy triggered with VITE_API_BASE_URL=${API_URL}"
