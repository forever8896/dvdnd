# Residence circuit (Groth16 / BN254)

Investors prove they are **not US residents** (Reg S) and not resident in a
sanctioned country, without revealing their country. The proof is generated in
the browser with snarkjs and verified on-chain by the Soroban `gate` contract
(`contracts/contracts/gate`) using the BN254 pairing host function. The
credential tree is recomputed on-chain with the Poseidon host function.

## Statement

```
commitment = Poseidon(secret)                             // what the investor gives the issuer
leaf      = Poseidon(country_code, expiry, commitment)    // ISO 3166-1 numeric, unix secs
leaf ∈ MerkleTree(root)                                   // Poseidon(2) per level, depth 16
country_code ∉ {840 US, 408 KP, 364 IR, 192 CU, 760 SY}
now < expiry                                              // both range-checked to 64 bits
nullifier == Poseidon(secret, scope)
address_hash * address_hash  (dummy constraint binding the proof to the investor)
```

| signal | visibility | notes |
|---|---|---|
| `root` | public #0 | must be one of the gate's last 30 roots |
| `now` | public #1 | must be within ±600 s of the ledger timestamp |
| `nullifier` | public #2 | stored on-chain, single use |
| `address_hash` | public #3 | recomputed on-chain from the caller's `Address` |
| `scope` | public #4 | e.g. `1` for platform-wide; per-offering ids allow one registration per offering |
| `country_code`, `expiry`, `secret`, `path_elements[16]`, `path_indices[16]` | private | |

**Public signal order** = `[root, now, nullifier, address_hash, scope]` (no
outputs, public inputs in declaration order). `prove.mjs` asserts this on every
proof, and the contract builds its input vector in the same order.

Tree: incremental "filled subtrees + zero hashes" tree, `zeros[0] = 0`,
`zeros[i+1] = Poseidon(zeros[i], zeros[i])`; `path_indices[i] = 1` means the
node is the right child at level i. Leaf `n` is the n-th `add_credential` call;
the app can rebuild the tree from the contract's `credential` events
(`IncrementalTree` in `scripts/lib.mjs`).

`address_hash` (identical in `lib.mjs::addressHash` and `gate::address_hash`):
`d = sha256(XDR(ScVal::Address(addr)))`, `hi = d[0..16]`, `lo = d[16..32]`
(big-endian u128), `address_hash = Poseidon(hi, lo)`.

The issuer builds the leaf itself from the country its KYC check verified, so an
investor can't choose their own country, and the issuer never sees the secret
(the nullifier and the proof both need it).

Size: 4,800 constraints (circom `--O2`), so a 2^13 Powers of Tau is enough.

## Build

```sh
pnpm install
pnpm build      # circom -> build/residence.r1cs, build/residence.wasm
pnpm fixture    # real proof -> build/fixture.json + contracts/contracts/gate/src/fixtures/residence.rs
```

## Trusted setup

The committed keys come from a ceremony recorded in
[`ceremony/TRANSCRIPT.md`](ceremony/TRANSCRIPT.md):

- **Phase 1:** the PSE Perpetual Powers of Tau (80 public contributions and a
  beacon), truncated to 2^13 and checked with `snarkjs powersoftau verify`.
- **Phase 2:** contributions with `scripts/ceremony.sh contribute "Name"`, each on
  the contributor's own machine, then a beacon from the hash of a Stellar mainnet
  ledger chosen before it closed.

The keys are sound if any single contributor destroyed their randomness. To
add a contribution, take the latest `build/ceremony/residence_NNNN.zkey`, run
`contribute`, then `beacon` and `finish` again. After any new key, re-run
`pnpm fixture` so the Rust tests match, `pnpm copy-to-app`, and
`scripts/testnet/set-vk.sh` so the gate verifies against it. The circuit and the
tree don't change, so existing credentials stay valid.

`pnpm setup` runs all ceremony steps with one local contribution, for
development only.

## Artifacts

| file | used by | in git |
|---|---|---|
| `build/residence.wasm` (~2.2 MB) | browser prover (witness) | yes |
| `build/residence_final.zkey` (~2.7 MB) | browser prover, from the ceremony | yes |
| `build/verification_key.json` | snarkjs off-chain verify | yes |
| `build/vk_soroban.json` | gate constructor / `set_vk` (hex, CLI JSON shape) | yes |
| `build/fixture.json` | example proof + encodings | yes |

`pnpm copy-to-app [dest]` copies wasm, zkey and VKs to `../app/public/zk`
(the default) so a Next.js app can fetch `/zk/residence.wasm` and `/zk/residence_final.zkey`.

## Proving

```js
import { proveResidence } from "./scripts/prove.mjs";
const out = await proveResidence({
  country: 276, expiry: 1792936000, secret,   // the investor's credential; the leaf is Poseidon(country, expiry, Poseidon(secret))
  leaves, // all leaves in insertion order (or path_elements + path_indices [+ root])
  now: Math.floor(Date.now() / 1000), scope: 1, address: "G...",
  wasm: "/zk/residence.wasm", zkey: "/zk/residence_final.zkey",
});
// out.soroban = { proof: {a, b, c}, root, now, nullifier, scope, address_hash }
```

CLI: `node scripts/prove.mjs input.json [out.json]` (same fields as JSON).
Private inputs are never written to the output.

Byte encodings expected by the contract (all big-endian, hex in JSON):

- Fr / U256: 32 bytes.
- G1: `x || y`, 64 bytes.
- G2: `x.c1 || x.c0 || y.c1 || y.c0`, 128 bytes. snarkjs writes `pi_b` / `vk_*_2` as
  `[[x.c0, x.c1], [y.c0, y.c1]]`, so **each pair is swapped** (EIP-197 order).

Then call `verify_and_register(investor, proof, root, now, nullifier, scope)`.
`lib.mjs` is browser-safe (no `fs`), so the app can import the helpers directly.
