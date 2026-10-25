#!/usr/bin/env bash
# Creates the compliance council: a testnet account controlled by three
# signers, any two of which must sign (low/medium/high thresholds 2). Its own
# master key is disabled, so no single key can act for it.
#
# Usage: scripts/testnet/council.sh
source "$(dirname "$0")/common.sh"

for k in council council-1 council-2 council-3; do
  stellar keys address "$k" >/dev/null 2>&1 || stellar keys generate "$k" --network "$NETWORK" --fund >/dev/null
done

stellar tx new set-options --network "$NETWORK" --source-account council --signer "$(addr council-1)" --signer-weight 1 >/dev/null
stellar tx new set-options --network "$NETWORK" --source-account council --signer "$(addr council-2)" --signer-weight 1 >/dev/null
stellar tx new set-options --network "$NETWORK" --source-account council --signer "$(addr council-3)" --signer-weight 1 >/dev/null
# Last: thresholds of 2 and master weight 0. After this, two council signers must sign.
stellar tx new set-options --network "$NETWORK" --source-account council \
  --low-threshold 2 --med-threshold 2 --high-threshold 2 --master-weight 0 >/dev/null

save_var COUNCIL "$(addr council)"
echo "Council $(addr council): 2 of 3 signers ($(addr council-1), $(addr council-2), $(addr council-3))"
