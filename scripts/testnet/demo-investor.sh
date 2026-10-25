#!/usr/bin/env bash
# Takes a demo investor through the whole flow on testnet:
# KYC credential -> on-chain Merkle tree -> browser-style ZK proof -> gate
# verification -> testnet USDC via XLM path payment.
#
# Usage: scripts/testnet/demo-investor.sh <identity> <country-numeric> <xlm-to-swap>
source "$(dirname "$0")/common.sh"

WHO=$1 COUNTRY=$2 XLM=$3
CRED_DIR="$ROOT/deployments/credentials"
LEAVES="$ROOT/deployments/leaves.txt"
mkdir -p "$CRED_DIR"
touch "$LEAVES"

# 1. KYC passed: the issuer (platform admin) adds the credential's leaf on-chain.
LEAF=$(node "$ROOT/scripts/testnet/zk.mjs" credential "$COUNTRY" "$CRED_DIR/$WHO.json")
INDEX=$(invoke "$GATE" "$ADMIN" -- add_credential --leaf "$LEAF")
echo "$LEAF" >> "$LEAVES"
echo "Credential for $WHO added at index $INDEX"

# 2. The investor proves non-US residence without revealing the credential.
NOW=$(date +%s)
ARGS=$(node "$ROOT/scripts/testnet/zk.mjs" prove "$CRED_DIR/$WHO.json" "$GATE" "$(addr "$WHO")" "$NOW")
field() { echo "$ARGS" | python3 -c "import sys,json; v=json.load(sys.stdin)['$1']; print(json.dumps(v) if isinstance(v, dict) else v)"; }
UNTIL=$(invoke "$GATE" "$WHO" -- verify_and_register --investor "$(addr "$WHO")" \
  --proof "$(field proof)" --root "$(field root)" --now "$(field now)" \
  --nullifier "$(field nullifier)" --scope "$(field scope)")
echo "$WHO eligible until $(date -d @"$UNTIL")"

# 3. Testnet USDC (Circle's) through a path payment from XLM.
fund_usdc "$WHO" "$XLM"
echo "$WHO funded with USDC"
