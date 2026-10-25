#!/usr/bin/env bash
# Shared settings for the testnet scripts. Contract IDs are written to
# deployments/testnet.env by deploy.sh and read back here.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NETWORK=testnet
WASM_DIR="$ROOT/contracts/target/wasm32v1-none/release"
DEPLOYMENTS="$ROOT/deployments/testnet.env"

# Circle's testnet USDC.
USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
USDC_ASSET="USDC:$USDC_ISSUER"

ADMIN=admin
TREASURY=treasury
FEE_BPS=500

[ -f "$DEPLOYMENTS" ] && source "$DEPLOYMENTS"

addr() { stellar keys address "$1"; }

invoke() {
  # invoke <contract-id> <source> -- <fn> [args...]
  local id=$1 src=$2; shift 2
  stellar contract invoke --network "$NETWORK" --id "$id" --source-account "$src" "$@"
}

save_var() {
  mkdir -p "$(dirname "$DEPLOYMENTS")"
  touch "$DEPLOYMENTS"
  grep -v "^$1=" "$DEPLOYMENTS" > "$DEPLOYMENTS.tmp" || true
  echo "$1=$2" >> "$DEPLOYMENTS.tmp"
  mv "$DEPLOYMENTS.tmp" "$DEPLOYMENTS"
  export "$1=$2"
}

# Deploys (or finds) the Stellar Asset Contract for a classic asset.
asset_contract() {
  local asset=$1 src=$2
  stellar contract asset deploy --network "$NETWORK" --source-account "$src" --asset "$asset" 2>/dev/null \
    || stellar contract id asset --network "$NETWORK" --asset "$asset"
}

# Gives an account a USDC trustline and swaps XLM for USDC on the testnet DEX.
fund_usdc() {
  local who=$1 xlm=$2
  stellar tx new change-trust --network "$NETWORK" --source-account "$who" --line "$USDC_ASSET" >/dev/null
  stellar tx new path-payment-strict-send --network "$NETWORK" --source-account "$who" \
    --send-asset native --send-amount "$((xlm * 10000000))" \
    --destination "$(addr "$who")" --dest-asset "$USDC_ASSET" --dest-min 1 >/dev/null
}
