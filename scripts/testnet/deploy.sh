#!/usr/bin/env bash
# Builds and deploys the contracts to testnet and records their IDs.
# Usage: scripts/testnet/deploy.sh   (needs the gate verifying key, see circuits/)
#
# Roles: the platform key ($ADMIN) verifies companies and issues credentials;
# the council multisig (scripts/testnet/council.sh) is registry admin and
# offering admin (it sets the flat listing fee). Compliance belongs to each
# raise. REUSE_REGISTRY=1 / REUSE_GATE=1 / REUSE_VAULT=1 keep the contracts
# already recorded in deployments/testnet.env.
source "$(dirname "$0")/common.sh"

(cd "$ROOT/contracts" && stellar contract build >/dev/null)

USDC_SAC=$(asset_contract "$USDC_ASSET" "$ADMIN")
save_var USDC_SAC "$USDC_SAC"
# The treasury receives the flat listing fee in USDC.
stellar tx new change-trust --network "$NETWORK" --source-account "$TREASURY" --line "$USDC_ASSET" >/dev/null

[ -n "${COUNCIL:-}" ] || { echo "Run scripts/testnet/council.sh first" >&2; exit 1; }

if [ -z "${REUSE_REGISTRY:-}" ]; then
  REGISTRY=$(stellar contract deploy --network "$NETWORK" --source-account "$ADMIN" \
    --wasm "$WASM_DIR/registry.wasm" --alias registry -- --admin "$COUNCIL" --verifier "$(addr "$ADMIN")")
  save_var REGISTRY "$REGISTRY"
fi

if [ -z "${REUSE_VAULT:-}" ]; then
  VAULT=$(stellar contract deploy --network "$NETWORK" --source-account "$ADMIN" \
    --wasm "$WASM_DIR/vault.wasm" --alias vault -- --usdc "$USDC_SAC")
  save_var VAULT "$VAULT"
fi

VK_JSON="$ROOT/circuits/build/vk_soroban.json"
if [ -z "${REUSE_GATE:-}" ]; then
  GATE=$(stellar contract deploy --network "$NETWORK" --source-account "$ADMIN" \
    --wasm "$WASM_DIR/gate.wasm" --alias gate -- --admin "$(addr "$ADMIN")" --vk "$(cat "$VK_JSON")")
  save_var GATE "$GATE"
fi

OFFERING=$(stellar contract deploy --network "$NETWORK" --source-account "$ADMIN" \
  --wasm "$WASM_DIR/offering.wasm" --alias offering -- \
  --admin "$COUNCIL" --gate "$GATE" --registry "$REGISTRY" --vault "$VAULT" \
  --usdc "$USDC_SAC" --treasury "$(addr "$TREASURY")" --listing_fee "$((LISTING_FEE * 10000000))")
save_var OFFERING "$OFFERING"

echo "Deployed:"
cat "$DEPLOYMENTS"
