#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm --prefix frontend ci --include=dev
VITE_GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}" npm --prefix frontend run build
npm --prefix backend ci --omit=dev
