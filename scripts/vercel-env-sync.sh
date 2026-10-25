#!/usr/bin/env bash
# Copies the named variables from app/.env.local to the Vercel project's
# production and preview environments without printing their values.
# Usage: scripts/vercel-env-sync.sh IDOS_RELAY_PRIVATE_KEY IDOS_CONSUMER_AUTH_KEY ...
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=app/.env.local
for name in "$@"; do
  value=$(python3 - "$ENV_FILE" "$name" <<'PY'
import sys
path, key = sys.argv[1], sys.argv[2]
for line in open(path):
    if line.startswith(key + "="):
        v = line[len(key) + 1:].rstrip("\n")
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        print(v.replace("\\n", "\n"), end="")
        break
else:
    sys.exit(f"{key} not found in {path}")
PY
)
  [ -n "$value" ] || { echo "$name is empty in $ENV_FILE" >&2; exit 1; }
  for target in production preview; do
    vercel env rm "$name" "$target" --yes >/dev/null 2>&1 || true
    flag=$([[ "$name" == NEXT_PUBLIC_* ]] && echo "" || echo "--sensitive")
    printf '%s' "$value" | vercel env add "$name" "$target" $flag >/dev/null
  done
  echo "synced $name"
done
