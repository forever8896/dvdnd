#!/usr/bin/env bash
# Installs the verifying key from circuits/build/vk_soroban.json on the
# deployed gate (after a new trusted setup). The gate admin signs.
#
# Usage: scripts/testnet/set-vk.sh
source "$(dirname "$0")/common.sh"
VK_JSON="$ROOT/circuits/build/vk_soroban.json"
stellar contract invoke --network "$NETWORK" --source-account "$ADMIN" --id "$GATE" --send=yes \
  -- set_vk --vk "$(cat "$VK_JSON")"
echo "gate $GATE now verifies against $(b2sum "$VK_JSON" | cut -c1-16)… ($VK_JSON)"
