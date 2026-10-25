#!/usr/bin/env bash
# Invokes a contract as the 2-of-3 council: builds the transaction with the
# council account as source, simulates it, signs it with two council signers
# and submits it. The council's own master key is disabled, so this is the
# only way it can act.
#
# Usage: scripts/testnet/council-invoke.sh <contract-id> -- <fn> [args...]
#   e.g. scripts/testnet/council-invoke.sh "$REGISTRY" -- suspend --id 8
source "$(dirname "$0")/common.sh"

ID=$1; shift
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
stellar contract invoke --network "$NETWORK" --id "$ID" --source-account council --build-only "$@" > "$TMP/tx"
stellar tx simulate --network "$NETWORK" --source-account council < "$TMP/tx" > "$TMP/sim"
stellar tx sign --network "$NETWORK" --sign-with-key "${SIGNER_A:-council-1}" < "$TMP/sim" > "$TMP/a" 2>/dev/null
stellar tx sign --network "$NETWORK" --sign-with-key "${SIGNER_B:-council-2}" < "$TMP/a" > "$TMP/b" 2>/dev/null
HASH=$(stellar tx hash --network "$NETWORK" < "$TMP/b")
stellar tx send --network "$NETWORK" < "$TMP/b" > /dev/null
echo "https://stellar.expert/explorer/$NETWORK/tx/$HASH"
