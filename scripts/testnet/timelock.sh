#!/usr/bin/env bash
# Admin changes go through the timelock (registry and offering admin).
#   scripts/testnet/timelock.sh schedule <contract-id> <function> '<args as ScVal JSON array>'
#     e.g. timelock.sh schedule "$OFFERING" set_listing_fee '[{"i128":"120000000"}]'
#   scripts/testnet/timelock.sh execute <call-id-hex>     (anyone, after the delay)
#   scripts/testnet/timelock.sh cancel <call-id-hex>      (council)
source "$(dirname "$0")/common.sh"
case "${1:-}" in
  schedule) "$(dirname "$0")/council-invoke.sh" "$TIMELOCK" -- schedule --target "$2" --function "$3" --args "$4" ;;
  execute) invoke "$TIMELOCK" "$ADMIN" -- execute --id "$2" ;;
  cancel) "$(dirname "$0")/council-invoke.sh" "$TIMELOCK" -- cancel --id "$2" ;;
  *) sed -n '2,7p' "$0"; exit 1 ;;
esac
