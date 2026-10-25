#!/usr/bin/env bash
# Tops up a testnet identity with test XLM. Friendbot only funds new accounts,
# so this funds N throwaway accounts (10,000 XLM each) and merges them into
# the target. Testnet resource fees can be high, so deploys may need this.
#
# Usage: scripts/testnet/topup.sh <identity> [count]
source "$(dirname "$0")/common.sh"

WHO=$1 COUNT=${2:-1}
for i in $(seq 1 "$COUNT"); do
  kp=$(stellar keys generate "topup-tmp-$$-$i" --network "$NETWORK" --fund --overwrite 2>/dev/null; echo "topup-tmp-$$-$i")
  stellar tx new account-merge --network "$NETWORK" --source-account "topup-tmp-$$-$i" --account "$(addr "$WHO")" >/dev/null
  stellar keys rm "topup-tmp-$$-$i" >/dev/null 2>&1 || true
done
curl -s "$NETWORK_HORIZON/accounts/$(addr "$WHO")" | python3 -c 'import sys,json; print("'"$WHO"' XLM:", [b["balance"] for b in json.load(sys.stdin)["balances"] if b["asset_type"]=="native"][0])'
