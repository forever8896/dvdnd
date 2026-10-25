# dvdnd contracts

Soroban contracts for dvdnd, built with `soroban-sdk` 28 (pinned so it works with `soroban-poseidon` 28).

| Contract | What it does |
|---|---|
| `registry` | Company records: platform ownership verification (KYB hash), signed profit-share agreement (hash, payout %, period). |
| `gate` | Investor eligibility. Verifies a Groth16 proof of non-US residence over BN254, keeps the credential Merkle tree on-chain with Poseidon, and stores one nullifier per credential. |
| `offering` | Fixed-price, all-or-nothing raises in USDC. SAC admin of each share token: mints exactly what was sold, authorizes only verified holders, takes the 5% platform fee on success, refunds on failure. |
| `vault` | Lock share tokens and receive USDC dividends. Only tokens locked for a whole period share that period's payout. |

```sh
cargo test                 # host tests for every contract
stellar contract build     # wasm in target/wasm32v1-none/release/
```

Deploying to testnet: see `../scripts/testnet/`.
