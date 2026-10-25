#!/usr/bin/env bash
# Runs a full raise -> tokens -> lock -> dividend -> claim cycle for one company
# and appends every transaction link to deployments/evidence.md.
#
# Usage: scripts/testnet/demo-lifecycle.sh <CODE> <owner-identity> <investorA> <usdcA> <investorB> <usdcB> <dividend-usdc>
source "$(dirname "$0")/common.sh"

CODE=$1 OWNER=$2 A=$3 AMT_A=$4 B=$5 AMT_B=$6 DIVIDEND=$7
RAISE_VAR="RAISE_$CODE" SHARE_VAR="SHARE_$CODE"
RAISE=${!RAISE_VAR} SHARE=${!SHARE_VAR}
EVIDENCE="$ROOT/deployments/evidence.md"
U=10000000

SKIP=${SKIP:-0} N=0
step() {
  N=$((N + 1)); [ "$N" -le "$SKIP" ] && return 0
  # step "<label>" <contract> <source> -- <fn> [args...]
  local label=$1; shift
  local out
  out=$(invoke "$@" 2>&1) || { echo "$out" >&2; exit 1; }
  local link
  link=$(echo "$out" | grep -o 'https://stellar.expert/explorer/testnet/tx/[0-9a-f]*' | tail -1)
  echo "- $label: $link" | tee -a "$EVIDENCE"
}

[ "$SKIP" -eq 0 ] && echo -e "\n## $CODE lifecycle ($(date -u +%F))" >> "$EVIDENCE"
step "$A invests $AMT_A USDC" "$OFFERING" "$A" -- invest --raise_id "$RAISE" --investor "$(addr "$A")" --amount "$((AMT_A * U))"
step "$B invests $AMT_B USDC" "$OFFERING" "$B" -- invest --raise_id "$RAISE" --investor "$(addr "$B")" --amount "$((AMT_B * U))"
step "Raise finalized (company paid, 5% fee)" "$OFFERING" "$OWNER" -- finalize --raise_id "$RAISE"
step "$A claims share tokens" "$OFFERING" "$A" -- claim_tokens --raise_id "$RAISE" --investor "$(addr "$A")"
step "$B claims share tokens" "$OFFERING" "$B" -- claim_tokens --raise_id "$RAISE" --investor "$(addr "$B")"
step "$A locks all tokens" "$VAULT" "$A" -- lock --token "$SHARE" --holder "$(addr "$A")" --amount "$((AMT_A * U))"
step "$B locks half" "$VAULT" "$B" -- lock --token "$SHARE" --holder "$(addr "$B")" --amount "$((AMT_B * U / 2))"
step "First dividend period starts" "$VAULT" "$OWNER" -- start_period --token "$SHARE"
step "Company pays $DIVIDEND USDC dividend" "$VAULT" "$OWNER" -- distribute --token "$SHARE" --from "$(addr "$OWNER")" --amount "$((DIVIDEND * U))"
step "$A claims dividend" "$VAULT" "$A" -- claim --token "$SHARE" --holder "$(addr "$A")"
step "$B claims dividend" "$VAULT" "$B" -- claim --token "$SHARE" --holder "$(addr "$B")"
