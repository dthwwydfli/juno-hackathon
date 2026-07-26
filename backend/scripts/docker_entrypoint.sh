#!/bin/sh
set -e

mkdir -p "$(dirname "$DMD_DB_PATH")" "$(dirname "$APP_DB_PATH")"

if [ ! -f "$DMD_DB_PATH" ] && [ -f /app/data/dmd.sample.sqlite ]; then
  cp /app/data/dmd.sample.sqlite "$DMD_DB_PATH"
fi

exec "$@"
