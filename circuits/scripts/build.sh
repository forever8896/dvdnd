#!/usr/bin/env bash
# Compile residence.circom -> build/residence.r1cs, build/residence_js/residence.wasm
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build
circom residence.circom --O2 --r1cs --wasm --sym -o build
cp build/residence_js/residence.wasm build/residence.wasm
npx snarkjs r1cs info build/residence.r1cs
