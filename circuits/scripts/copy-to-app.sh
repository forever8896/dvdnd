#!/usr/bin/env bash
# Copy the prover artifacts where a Next.js app serves static files.
# Usage: bash scripts/copy-to-app.sh [dest]   (default: ../app/public/zk)
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="${1:-../app/public/zk}"
mkdir -p "$DEST"
cp build/residence.wasm build/residence_final.zkey build/verification_key.json build/vk_soroban.json "$DEST/"
echo "copied prover artifacts to $DEST"
