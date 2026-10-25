#!/usr/bin/env bash
# Onboards a demo company end to end on testnet:
# issue its share asset with compliance flags, hand the SAC admin to the
# offering contract, register + verify + sign the agreement, and open a raise.
#
# Usage: scripts/testnet/demo-company.sh <CODE> <owner-identity> <issuer-identity> \
#          "<name>" <country-numeric> <payout-bps> <min-usdc> <max-usdc> <duration-seconds>
# Optional: PROFILE_JSON='{"sector":…,"city":…,"description":…,"netProfit":…}' stores the
# profile on-chain as a data: URI, which the app reads.
source "$(dirname "$0")/common.sh"

CODE=$1 OWNER=$2 ISSUER=$3 NAME=$4 COUNTRY=$5 PAYOUT_BPS=$6 MIN=$7 MAX=$8 DURATION_SECS=$9
PRICE=10000000 # 1.00 USDC per token
YEAR=31536000

# 1. Share asset: holders must be authorized, can be frozen, can be clawed back.
stellar tx new set-options --network "$NETWORK" --source-account "$ISSUER" \
  --set-required --set-revocable --set-clawback-enabled >/dev/null
SHARE_SAC=$(asset_contract "$CODE:$(addr "$ISSUER")" "$ISSUER")
echo "Share token $CODE SAC: $SHARE_SAC"

# 2. Only the offering contract can mint or authorize from now on.
invoke "$SHARE_SAC" "$ISSUER" -- set_admin --new_admin "$OFFERING" >/dev/null

if [ -n "${PROFILE_JSON:-}" ]; then
  PROFILE_URI="data:application/json;base64,$(printf '%s' "$PROFILE_JSON" | base64 -w0)"
else
  PROFILE_URI="https://example.com/$CODE.json"
fi

# 3. Registry: register, platform verifies ownership, owner signs the agreement.
COMPANY_ID=$(invoke "$REGISTRY" "$OWNER" -- register --owner "$(addr "$OWNER")" \
  --name "\"$NAME\"" --country "$COUNTRY" --profile_uri "\"$PROFILE_URI\"" | tr -d '"')
KYB_HASH=$(printf 'kyb:%s' "$NAME" | sha256sum | cut -d' ' -f1)
AGREEMENT_HASH=$(printf 'agreement:%s:%s' "$NAME" "$PAYOUT_BPS" | sha256sum | cut -d' ' -f1)
invoke "$REGISTRY" "$ADMIN" -- verify --id "$COMPANY_ID" --kyb_hash "$KYB_HASH" >/dev/null
invoke "$REGISTRY" "$OWNER" -- sign_agreement --id "$COMPANY_ID" \
  --agreement_hash "$AGREEMENT_HASH" --payout_bps "$PAYOUT_BPS" --period_secs "$YEAR" >/dev/null
echo "Company $COMPANY_ID registered, verified, agreement $AGREEMENT_HASH"

# The owner receives the raise and pays dividends in USDC.
stellar tx new change-trust --network "$NETWORK" --source-account "$OWNER" --line "$USDC_ASSET" >/dev/null

# 4. Open the raise.
DEADLINE=$(( $(date +%s) + DURATION_SECS ))
RAISE_ID=$(invoke "$OFFERING" "$OWNER" -- open_raise --company_id "$COMPANY_ID" --token "$SHARE_SAC" \
  --price "$PRICE" --min_raise "$((MIN * 10000000))" --max_raise "$((MAX * 10000000))" --deadline "$DEADLINE")
echo "Raise $RAISE_ID open until $(date -d @"$DEADLINE")"

save_var "SHARE_${CODE}" "$SHARE_SAC"
save_var "COMPANY_${CODE}" "$COMPANY_ID"
save_var "RAISE_${CODE}" "$RAISE_ID"
