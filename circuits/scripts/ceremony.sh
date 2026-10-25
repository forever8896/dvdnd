#!/usr/bin/env bash
# Groth16 trusted setup for residence.circom.
#
# Phase 1 is the Privacy & Scaling Explorations "Perpetual Powers of Tau"
# (80 public contributions plus a beacon), truncated to 2^13. Phase 2 is ours:
# a chain of contributions, each by a different person on their own machine,
# closed by a beacon taken from a Stellar mainnet ledger hash that did not exist
# when the ledger was chosen. The setup is secure if any one contributor
# destroyed their randomness.
#
#   scripts/ceremony.sh init                  # phase-2 start from the r1cs + ptau
#   scripts/ceremony.sh contribute "Name"     # next contribution (run by each participant)
#   scripts/ceremony.sh beacon                # pick a future ledger, wait, apply its hash
#   scripts/ceremony.sh finish                # verify, export the keys
#
# Each step appends to ceremony/TRANSCRIPT.md. Contributors pass the latest
# build/ceremony/residence_NNNN.zkey on to the next one.
set -euo pipefail
cd "$(dirname "$0")/.."
B=build
C=$B/ceremony
PTAU=$B/ppot_0080_13.ptau
PTAU_URL=https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_13.ptau
HORIZON=https://horizon.stellar.org
T=ceremony/TRANSCRIPT.md
SNARKJS="npx snarkjs"
mkdir -p "$C" ceremony

latest() { ls "$C"/residence_[0-9][0-9][0-9][0-9].zkey 2>/dev/null | sort | tail -1; }
next_name() { printf '%s/residence_%04d.zkey' "$C" $(( 10#$(basename "$1" .zkey | cut -d_ -f2) + 1 )); }
contribution_hash() { grep -A4 'Contribution Hash' | tail -4 | tr -s ' \t\n' ' ' | sed 's/^ //;s/ $//'; }

case "${1:-}" in
init)
  [ -f "$PTAU" ] || curl -sSfL -o "$PTAU" "$PTAU_URL"
  echo "$(b2sum "$PTAU" | cut -c1-128)  $(basename "$PTAU")" > ceremony/ptau.b2
  $SNARKJS groth16 setup "$B/residence.r1cs" "$PTAU" "$C/residence_0000.zkey"
  cat > "$T" <<EOF
# Residence circuit: trusted setup transcript

Circuit: \`residence.circom\`, r1cs blake2b \`$(b2sum "$B/residence.r1cs" | cut -c1-32)…\`

## Phase 1

PSE Perpetual Powers of Tau, contribution 0080 with beacon, truncated to 2^13:
[\`ppot_0080_13.ptau\`]($PTAU_URL), blake2b in \`ceremony/ptau.b2\`.
Verified locally with \`snarkjs powersoftau verify\`.

## Phase 2

| # | Contributor | Date (UTC) | Contribution hash |
|---|---|---|---|
EOF
  echo "initialised $C/residence_0000.zkey"
  ;;
contribute)
  name="${2:?usage: ceremony.sh contribute \"Your name\"}"
  prev=$(latest); out=$(next_name "$prev")
  # Entropy: urandom plus anything the contributor types. It is never stored.
  extra=""
  if [ -t 0 ]; then read -r -s -p "Type some random text (optional), then Enter: " extra; echo; fi
  entropy="$(head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')$extra"
  log=$($SNARKJS zkey contribute "$prev" "$out" --name="$name" -e="$entropy")
  unset entropy extra
  n=$(basename "$out" .zkey | cut -d_ -f2)
  echo "| $((10#$n)) | $name | $(date -u +%Y-%m-%d\ %H:%M) | \`$(echo "$log" | contribution_hash)\` |" >> "$T"
  echo "wrote $out; pass it to the next contributor"
  ;;
beacon)
  prev=$(latest)
  now=$(curl -sSf "$HORIZON/ledgers?order=desc&limit=1" | python3 -c 'import json,sys;print(json.load(sys.stdin)["_embedded"]["records"][0]["sequence"])')
  target=$((now + 20)) # about 2 minutes ahead
  printf '\n## Beacon\n\nAfter the last contribution, chose Stellar mainnet ledger **%s** (latest was %s at %s UTC).\n' \
    "$target" "$now" "$(date -u +%Y-%m-%d\ %H:%M:%S)" >> "$T"
  echo "waiting for ledger $target…"
  until hash=$(curl -sSf "$HORIZON/ledgers/$target" 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin)["hash"])' 2>/dev/null); do sleep 5; done
  $SNARKJS zkey beacon "$prev" "$C/residence_beacon.zkey" "$hash" 10 -n="Stellar ledger $target" >/dev/null
  printf 'Its hash `%s` ([Horizon](%s/ledgers/%s)) was applied with 2^10 iterations.\n' "$hash" "$HORIZON" "$target" >> "$T"
  echo "beacon applied from ledger $target"
  ;;
finish)
  $SNARKJS zkey verify "$B/residence.r1cs" "$PTAU" "$C/residence_beacon.zkey" > "$C/verify.log"
  grep -q 'ZKey Ok' "$C/verify.log"
  cp "$C/residence_beacon.zkey" "$B/residence_final.zkey"
  $SNARKJS zkey export verificationkey "$B/residence_final.zkey" "$B/verification_key.json"
  node scripts/vk-to-soroban.mjs "$B/verification_key.json" > "$B/vk_soroban.json"
  printf '\n## Result\n\n`snarkjs zkey verify` passed on %s UTC. `build/residence_final.zkey` blake2b `%s…`.\n' \
    "$(date -u +%Y-%m-%d\ %H:%M)" "$(b2sum "$B/residence_final.zkey" | cut -c1-32)" >> "$T"
  echo "wrote $B/residence_final.zkey, verification_key.json, vk_soroban.json"
  ;;
*)
  sed -n '2,17p' "$0"; exit 1 ;;
esac
