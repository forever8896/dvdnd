#!/usr/bin/env bash
# Onboards a demo company end to end on testnet:
# issue its share asset with compliance flags, hand the SAC admin to the
# offering contract, register + verify + sign the agreement, and open a raise.
#
# Usage: scripts/testnet/demo-company.sh <CODE> <owner-identity> <issuer-identity> \
#          "<name>" <country-numeric> <payout-bps> <min-usdc> <max-usdc> <duration-seconds>
# Optional: PROFILE_JSON='{"sector":…,"city":…,"description":…,"netProfit":…}' stores the
# profile on-chain as a data: URI, which the app reads.
# Raise terms (env): EXEMPTION=regs|506c|both (default regs), LOCKUP_SECS after the
# deadline (default 0; 506c and both need at least a year), MIN_TICKET and MAX_HOLDERS
# (default 0 and 500), COMPLIANCE identity (default the owner), VERIFIER identity
# (506c accreditation verifier, optional). The owner pays the flat listing fee.
source "$(dirname "$0")/common.sh"

CODE=$1 OWNER=$2 ISSUER=$3 NAME=$4 COUNTRY=$5 PAYOUT_BPS=$6 MIN=$7 MAX=$8 DURATION_SECS=$9
PRICE=10000000 # 1.00 USDC per token
YEAR=31536000

# 1. Share asset: holders must be authorized, can be frozen, can be clawed back.
stellar tx new set-options --network "$NETWORK" --source-account "$ISSUER" \
  --set-required --set-revocable --set-clawback-enabled --home-domain "${SITE_DOMAIN:-dvdnd.vercel.app}" >/dev/null
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
# The same plain-language agreement the app shows and verifies (app/src/lib/agreement.ts).
AGREEMENT_HASH=$(node --no-warnings --input-type=module -e "
  import { signedAgreement } from '$ROOT/app/src/lib/agreement.ts';
  import { createHash } from 'node:crypto';
  const [name, bps, secs] = process.argv.slice(1);
  process.stdout.write(createHash('sha256').update(signedAgreement({ name, payout_bps: Number(bps), period_secs: Number(secs) })).digest('hex'));
" "$NAME" "$PAYOUT_BPS" "$YEAR")
invoke "$REGISTRY" "$ADMIN" -- verify --id "$COMPANY_ID" --kyb_hash "$KYB_HASH" >/dev/null
invoke "$REGISTRY" "$OWNER" -- sign_agreement --id "$COMPANY_ID" \
  --agreement_hash "$AGREEMENT_HASH" --payout_bps "$PAYOUT_BPS" --period_secs "$YEAR" >/dev/null
echo "Company $COMPANY_ID registered, verified, agreement $AGREEMENT_HASH"

# The owner receives the raise, pays the listing fee and pays dividends in USDC.
fund_usdc "$OWNER" 400

# 4. Open the raise under its exemption.
DEADLINE=$(( $(date +%s) + DURATION_SECS ))
case "${EXEMPTION:-regs}" in
  regs) EX=0 ;;
  506c) EX=1 ;;
  both) EX=2 ;;
  *) echo "EXEMPTION must be regs, 506c or both" >&2; exit 1 ;;
esac
VERIFIER_JSON=$([ -n "${VERIFIER:-}" ] && echo "\"$(addr "$VERIFIER")\"" || echo null)
TERMS=$(printf '{"exemption":%s,"min_ticket":"%s","max_holders":%s,"lockup_until":%s,"compliance":"%s","verifier":%s}' \
  "$EX" "$(( ${MIN_TICKET:-0} * 10000000 ))" "${MAX_HOLDERS:-500}" "$(( DEADLINE + ${LOCKUP_SECS:-0} ))" \
  "$(addr "${COMPLIANCE:-$OWNER}")" "$VERIFIER_JSON")
RAISE_ID=$(invoke "$OFFERING" "$OWNER" -- open_raise --company_id "$COMPANY_ID" --token "$SHARE_SAC" \
  --price "$PRICE" --min_raise "$((MIN * 10000000))" --max_raise "$((MAX * 10000000))" --deadline "$DEADLINE" \
  --terms "$TERMS")
echo "Raise $RAISE_ID (${EXEMPTION:-regs}) open until $(date -d @"$DEADLINE"), lock-up until $(date -d @"$(( DEADLINE + ${LOCKUP_SECS:-0} ))")"

save_var "SHARE_${CODE}" "$SHARE_SAC"
save_var "COMPANY_${CODE}" "$COMPANY_ID"
save_var "RAISE_${CODE}" "$RAISE_ID"
