# dvdnd architecture

## Overview

```
Company (owner G-account)                  Investor (G-account or passkey wallet)
   │ register / sign agreement                │ KYC check (off-chain issuer)
   ▼                                          ▼
┌──────────┐   owner_if_active   ┌──────────┐   is_eligible   ┌──────────┐
│ registry │ ◄────────────────── │ offering │ ──────────────► │   gate   │
└──────────┘                     └──────────┘                 └──────────┘
                                   │ SAC admin                  ▲ Groth16 proof (BN254)
                                   ▼                            │ Poseidon Merkle tree
                         ┌──────────────────┐                   │
                         │ share token SAC  │      browser prover (snarkjs + circuit wasm)
                         │ AUTH_REQUIRED    │
                         │ AUTH_REVOCABLE   │
                         │ CLAWBACK_ENABLED │
                         └──────────────────┘
                                   │ lock / unlock
                                   ▼
                              ┌─────────┐   distribute (USDC)   Company
                              │  vault  │ ◄──────────────────
                              └─────────┘ ──► claim (USDC) ──► Investor
```

Four Soroban contracts, one share token per company (a classic Stellar asset with its Stellar Asset Contract), and Circle USDC.

## Assets

| Asset | Type | Notes |
|---|---|---|
| USDC | Circle-issued classic asset, used through its SAC | Testnet issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`; mainnet issuer `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| Company share token (e.g. `ANDES`) | Classic asset issued by a per-company issuer account | Flags `AUTH_REQUIRED`, `AUTH_REVOCABLE`, `AUTH_CLAWBACK_ENABLED` set before any trustline exists. SAC admin handed to `offering`. 7 decimals, 1 token = 1.00 USDC at the raise price in the demo. |

## Contracts

### registry
- Stores each company: owner, name, country, profile URL, KYB evidence hash, agreement hash, payout share (bps) and dividend period.
- Status runs `Pending → Verified` (platform admin, after the ownership check) `→ Active` (owner signs the agreement).
- `owner_if_active(id)` is what `offering` checks before a raise can open.

### gate: investor eligibility
- **Credential:** after an off-chain KYC check, the platform (issuer) adds `leaf = Poseidon(country, expiry, secret)` with `add_credential`. The contract inserts it into a depth-16 incremental Merkle tree, computing every hash on-chain with the Poseidon host function. It keeps the last 30 roots.
- **Proof:** in the browser, the investor proves with the circom circuit that:
  - their leaf is in the tree under a known root,
  - `country ∉ {840 US, 408, 364, 192, 760}`,
  - `expiry > now`,
  - `nullifier = Poseidon(secret, scope)`.
  The address hash is bound into the proof.
- **Verification:** `verify_and_register` checks:
  - the root is recent,
  - `now` is within 10 minutes of ledger time,
  - the scope is the platform scope (one address per credential),
  - the nullifier is unused,
  - inputs are canonical,
  - and runs the Groth16 check: `vk_x = ic[0] + g1_msm(ic[1..], inputs)`, then one `pairing_check`.
  On success the investor is eligible for 365 days.
- **Address binding:** `address_hash = Poseidon(hi, lo)` of `sha256(XDR(ScVal::Address))`, so a proof can't be replayed for another address.
- **Public inputs, in order:** `[root, now, nullifier, address_hash, scope]`.
- **Cost:** about 30M CPU instructions per verification and 19M per credential insert.
- Residence, not nationality, is what Regulation S uses to define a US person, so the circuit checks country of residence.

### offering: fixed-price, all-or-nothing raises
- `open_raise` (company owner):
  - requires an active company and that `offering` is the share SAC's admin,
  - fixes price, min, max and deadline,
  - authorizes the vault to hold the token.
- `invest`: the investor must pass `gate.is_eligible`. USDC is held in escrow.
- `finalize`: anyone may call it once the raise is full or past its deadline.
  - Success: 5% of the raise goes to the treasury, the rest to the company.
  - Failure: refunds open.
- `claim_tokens` creates the trustline (`trust`), authorizes the holder and mints exactly `contribution / price`. This is the only mint path, and there is no function to move the SAC admin, so supply is fixed by code.
- `refund` returns USDC in full after a failed raise.
- `authorize_holder` lets other verified investors hold the token, for secondary trading.
- `revoke_holder` (platform admin) freezes a holder, for example one who moved to the US.

### vault: locks and dividends
- Per share token:
  - a reward-per-token accumulator (×1e18),
  - `active_total` (earning this period) and `pending_total` (earning from next period),
  - a snapshot of the accumulator at each period start.
- `lock`: tokens become pending and start earning from the next period. `unlock` returns pending tokens first. Active tokens unlocked mid-period earn nothing for it.
- `start_period` activates pending tokens, but only while nothing is earning yet (bootstrap). After that, periods advance only through `distribute`.
- `distribute(token, from, amount)` is the company's payout. It is shared by `active_total` and starts the next period.
- `claim` pays all settled USDC.
- Every call costs the same however many holders there are; there is no loop over holders.

## Off-chain pieces

| Piece | Role |
|---|---|
| KYC issuer (platform) | Checks residence, then adds the credential leaf on-chain. The demo uses a mock issuer; production would use a KYC vendor. |
| Browser prover | `circuits/build/residence.wasm` + `residence_final.zkey` with snarkjs. Private inputs never leave the device. |
| Company verification | Registry director match and DNS/stellar.toml domain check. The evidence bundle's hash is stored in `registry`. |
| Anchors | Demo: `testanchor.stellar.org` (SEP-10/24). Production: Circle Mint for company deposits and payouts, MoneyGram Ramps and regional anchors for investor cash-out. |

## Trust and limits
- The profit-share agreement is enforced legally, off-chain. The chain records its hash and every payout.
- The platform admin can verify companies, add credentials and freeze holders. In production these powers should sit behind a multisig and timelock.
- Single-contributor trusted setup: development only.
- Eligibility lasts a year after proving, regardless of when the credential itself expires.
