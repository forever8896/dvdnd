#!/usr/bin/env bash
# Builds and deploys the four contracts to testnet and records their IDs.
# Usage: scripts/testnet/deploy.sh   (needs the gate verifying key, see circuits/)
source "$(dirname "$0")/common.sh"

(cd "$ROOT/contracts" && stellar contract build >/dev/null)

USDC_SAC=$(asset_contract "$USDC_ASSET" "$ADMIN")
save_var USDC_SAC "$USDC_SAC"
# The treasury receives the 5% fee in USDC.
stellar tx new change-trust --network "$NETWORK" --source-account "$TREASURY" --line "$USDC_ASSET" >/dev/null

REGISTRY=$(stellar contract deploy --network "$NETWORK" --source-account "$ADMIN" \
  --wasm "$WASM_DIR/registry.wasm" --alias registry -- --admin "$(addr "$ADMIN")")
save_var REGISTRY "$REGISTRY"

VAULT=$(stellar contract deploy --network "$NETWORK" --source-account "$ADMIN" \
  --wasm "$WASM_DIR/vault.wasm" --alias vault -- --usdc "$USDC_SAC")
save_var VAULT "$VAULT"

VK_JSON="$ROOT/circuits/build/vk_soroban.json"
GATE=$(stellar contract deploy --network "$NETWORK" --source-account "$ADMIN" \
  --wasm "$WASM_DIR/gate.wasm" --alias gate -- --admin "$(addr "$ADMIN")" --vk "$(cat "$VK_JSON")")
save_var GATE "$GATE"

OFFERING=$(stellar contract deploy --network "$NETWORK" --source-account "$ADMIN" \
  --wasm "$WASM_DIR/offering.wasm" --alias offering -- \
  --admin "$(addr "$ADMIN")" --gate "$GATE" --registry "$REGISTRY" --vault "$VAULT" \
  --usdc "$USDC_SAC" --treasury "$(addr "$TREASURY")" --fee_bps "$FEE_BPS")
save_var OFFERING "$OFFERING"

echo "Deployed:"
cat "$DEPLOYMENTS"
