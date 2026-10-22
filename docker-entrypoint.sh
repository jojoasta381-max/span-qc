#!/bin/sh
set -e

# Ensure data directory and storage exist
mkdir -p /app/data /app/storage

# If persistent SQLite database doesn't exist yet, initialize from template
if [ ! -f /app/data/dev.db ]; then
  echo "[spanqc-web] Initializing fresh SQLite database at /app/data/dev.db..."
  if [ -f /app/prisma/dev.db ]; then
    cp /app/prisma/dev.db /app/data/dev.db
    echo "[spanqc-web] Database initialized successfully."
  else
    touch /app/data/dev.db
  fi
fi

exec "$@"
