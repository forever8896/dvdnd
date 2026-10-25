# Residence circuit: trusted setup transcript

Circuit: `residence.circom`, r1cs blake2b `7017df6ccd56a41fa273ea37a4acc7af…`

## Phase 1

PSE Perpetual Powers of Tau, contribution 0080 with beacon, truncated to 2^13:
[`ppot_0080_13.ptau`](https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_13.ptau), blake2b in `ceremony/ptau.b2`.
Verified locally with `snarkjs powersoftau verify` on 2026-10-25 ("Powers of Tau Ok!"; the beacon
matches the Ethereum randao value PSE published).

## Phase 2

| # | Contributor | Date (UTC) | Contribution hash |
|---|---|---|---|
| 1 | Claude (dvdnd build session) | 2026-10-25 15:35 | `02d9c827 c5b2f1a5 6beb2207 48c2fc66 9016dc43 0331a80a 55dfd878 123a3e99 3255b125 dcda9d21 5ec48f34 6024382b 7ae4844e 691d45fb 9eb464bf 1a5a68ab` |

## Beacon

After the last contribution, chose Stellar mainnet ledger **65131374** (latest was 65131354 at 2026-10-25 15:35:55 UTC).
Its hash `d7a7cd92f675e208062c4f923a7c5497f0f8bf8744a0347685b5e6554cf2ce31` ([Horizon](https://horizon.stellar.org/ledgers/65131374)) was applied with 2^10 iterations.

## Result

`snarkjs zkey verify` passed on 2026-10-25 15:37 UTC. `build/residence_final.zkey` blake2b `3469b0628ca5491503c4bb3bafa3772d…`.
