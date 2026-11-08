#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "[github-manager] Created .env from .env.example (set GITHUB_PAT in .env or connect in the web UI)."
fi

if [ ! -d "web/node_modules" ]; then
  echo "[github-manager] Installing frontend dependencies..."
  (cd web && npm install)
fi

echo "[github-manager] Building frontend static bundle..."
(cd web && npm run build)

echo "[github-manager] Starting Actix Web server..."
exec cargo run
