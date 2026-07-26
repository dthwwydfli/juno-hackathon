#!/usr/bin/env bash
# Expose local :8000 over HTTPS for Vercel / phone testing (localtunnel).
# Dev only — for demos use ngrok or Cloudflare Tunnel (see docs/deploy-vercel-phone-scan.md).
# After the URL prints, set backend PUBLIC_BASE_URL and Vercel VITE_* vars to that URL (no trailing slash).
set -euo pipefail
PORT="${PORT:-8000}"
echo "Starting localtunnel → http://127.0.0.1:${PORT}"
echo "Keep this terminal open. Update backend/.env PUBLIC_BASE_URL and Vercel env vars when the URL appears."
exec npx --yes localtunnel --port "${PORT}"
