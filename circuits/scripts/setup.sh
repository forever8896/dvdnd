#!/usr/bin/env bash
# DEV trusted setup for residence.circom (Groth16 / BN254).
#
# Phase 1 (Powers of Tau, 2^13 = 8192 constraints) and phase 2 are generated
# locally with a single random contribution each. That is fine for a hackathon
# demo but NOT a secure ceremony: whoever runs this script could forge proofs if
# they kept the toxic waste. For production, use a public ptau (e.g. Hermez
# powersOfTau28_hez_final_13.ptau) and a multi-party phase-2 ceremony.
set -euo pipefail
cd "$(dirname "$0")/.."
B=build
SNARKJS="npx snarkjs"
POWER=13
rnd() { head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

if [ ! -f "$B/pot${POWER}_final.ptau" ]; then
  $SNARKJS powersoftau new bn128 $POWER "$B/pot${POWER}_0000.ptau"
  $SNARKJS powersoftau contribute "$B/pot${POWER}_0000.ptau" "$B/pot${POWER}_0001.ptau" \
    --name="dev contribution" -e="$(rnd)"
  $SNARKJS powersoftau beacon "$B/pot${POWER}_0001.ptau" "$B/pot${POWER}_beacon.ptau" \
    "$(rnd)" 10 -n="dev beacon"
  $SNARKJS powersoftau prepare phase2 "$B/pot${POWER}_beacon.ptau" "$B/pot${POWER}_final.ptau"
  rm -f "$B/pot${POWER}_0000.ptau" "$B/pot${POWER}_0001.ptau" "$B/pot${POWER}_beacon.ptau"
fi

$SNARKJS groth16 setup "$B/residence.r1cs" "$B/pot${POWER}_final.ptau" "$B/residence_0000.zkey"
$SNARKJS zkey contribute "$B/residence_0000.zkey" "$B/residence_final.zkey" \
  --name="dev phase2" -e="$(rnd)"
rm -f "$B/residence_0000.zkey"
$SNARKJS zkey verify "$B/residence.r1cs" "$B/pot${POWER}_final.ptau" "$B/residence_final.zkey"
$SNARKJS zkey export verificationkey "$B/residence_final.zkey" "$B/verification_key.json"
node scripts/vk-to-soroban.mjs "$B/verification_key.json" > "$B/vk_soroban.json"
echo "wrote $B/residence_final.zkey, $B/verification_key.json, $B/vk_soroban.json"
