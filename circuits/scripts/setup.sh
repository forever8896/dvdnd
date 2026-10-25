#!/usr/bin/env bash
# One-shot setup for local development: runs the ceremony steps in a row with a
# single local contribution. The committed keys come from ceremony/TRANSCRIPT.md;
# see scripts/ceremony.sh to take part in or rerun the real ceremony.
set -euo pipefail
cd "$(dirname "$0")"
bash ceremony.sh init
bash ceremony.sh contribute "local dev" </dev/null
bash ceremony.sh beacon
bash ceremony.sh finish
