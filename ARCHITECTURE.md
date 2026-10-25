# dvdnd architecture

## Overview

```
Company (owner G-account)                         Investor (Stellar wallet: xBull, Freighter, …)
   │ register · verify (DNS, GLEIF) ·                 │ identity check (Didit, hosted) ──► dvdnd issuer
   │ sign agreement (hash on-chain)                   │   reads the decision, builds the leaf from the
   ▼                                                  ▼   verified country + Poseidon(secret)
┌──────────┐   owner_if_active   ┌──────────┐  is_eligible  ┌──────────┐
│ registry │ ◄────────────────── │ offering │ ────────────► │   gate   │ ◄─ Groth16 proof (BN254),
└──────────┘                     └──────────┘   (Reg S)     └──────────┘    Poseidon Merkle tree
     ▲ admin: council (2-of-3)      │ per-raise terms:            ▲          browser prover (snarkjs)
                                    │ exemption, lock-up,         │
                                    │ holder cap, compliance acct │ add_credential (platform issuer)
                                    │ SAC admin
                                    ▼
                         ┌──────────────────┐  claim during lock-up ──► straight into the vault,
                         │ share token SAC  │                           wallet frozen until release
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

Five Soroban contracts (the four below plus `timelock`), one share token per company (a classic Stellar asset with its Stellar Asset Contract), and Circle USDC. Contract IDs are in the README and `deployments/testnet.env`; every demo transaction is in `deployments/evidence.md`.

## Assets

| Asset | Type | Notes |
|---|---|---|
| USDC | Circle-issued classic asset, used through its SAC | Testnet issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`; mainnet issuer `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| Company share token (e.g. `ANDES`) | Classic asset issued by a per-company issuer account | Flags `AUTH_REQUIRED`, `AUTH_REVOCABLE`, `AUTH_CLAWBACK_ENABLED` set before any trustline exists; `home_domain` points to dvdnd's `stellar.toml`. SAC admin handed to `offering`. 7 decimals. |

## Roles

| Role | Account | Powers |
|---|---|---|
| Council | 2-of-3 multisig G-account, master key weight 0 | Registry admin (suspend companies, change roles); offering admin (sets the flat listing fee). No power over holders. `scripts/testnet/council-invoke.sh` collects two signatures. |
| Platform key | `DVDND_ADMIN_SECRET` (server) | Registry verifier (marks companies verified after the ownership check); gate admin and credential issuer. |
| Compliance account | Set per raise: the company or its transfer agent | Freeze, unfreeze, claw back, each with a recorded reason; can hand the role on. |
| Accreditation verifier | Optional per 506(c) raise | Attests accredited investors. On testnet the platform key stands in for a verification service. |

## Contracts

### registry
- Stores each company: owner, name, country, profile, KYB evidence hash, agreement hash, payout share (bps) and dividend period.
- Status runs `Pending → Verified` (platform verifier, after the DNS and GLEIF checks) `→ Active` (owner signs the agreement); the council can `suspend`.
- The agreement text is fully determined by on-chain fields (`app/src/lib/agreement.ts`), so a raise page rebuilds it and checks its sha256 against the registry.
- `owner_if_active(id)` is what `offering` checks before a raise can open.

### gate: investor eligibility (Reg S)
- **Credential (circuit v2):** the investor's browser picks a random `secret` and sends only `Poseidon(secret)`. After the identity check, the issuer adds `leaf = Poseidon(country, expiry, Poseidon(secret))` with `add_credential`, using the country the check verified. The contract inserts it into a depth-16 incremental Merkle tree, every hash computed on-chain with the Poseidon host function, and keeps the last 30 roots.
- **Proof:** in the browser, the investor proves with the circom circuit that:
  - their leaf is in the tree under a known root,
  - `country ∉ {840 US, 408, 364, 192, 760}`,
  - `expiry > now`,
  - `nullifier = Poseidon(secret, scope)`.
  The address hash is bound into the proof.
- **Verification:** `verify_and_register` checks the root is recent, `now` is within 10 minutes of ledger time, the scope is the platform scope (one address per credential), the nullifier is unused and inputs are canonical, then runs Groth16: `vk_x = ic[0] + g1_msm(ic[1..], inputs)` and one `pairing_check`. On success the investor is eligible for 365 days.
- **Address binding:** `address_hash = Poseidon(hi, lo)` of `sha256(XDR(ScVal::Address))`, so a proof can't be replayed for another address.
- **Public inputs, in order:** `[root, now, nullifier, address_hash, scope]`.
- **Keys:** from the ceremony in `circuits/ceremony/TRANSCRIPT.md` (PSE Perpetual Powers of Tau plus a phase 2 closed with a Stellar-ledger beacon), installed with `set_vk`.
- **Cost:** about 30M CPU instructions per verification and 19M per credential insert.

### offering: raises under an exemption
- `open_raise` (company owner) pays the flat listing fee and fixes price, min, max, deadline and the raise's **terms**:
  - `exemption`: Reg S (gate proof), Reg D 506(c) (accredited) or both side by side;
  - `min_ticket`, `max_holders` (at most 2,000, the Exchange Act §12(g) trigger);
  - `lockup_until` (Reg D needs at least a year after the deadline, Rule 144);
  - `compliance` (company or transfer agent) and an optional accreditation `verifier`.
- **Eligibility:** Reg S requires `gate.is_eligible`. 506(c) requires a verifier's current attestation, or a self-certification (`self_certify`, sha256 of the signed statement, person or entity) with at least 200,000 USDC invested (1,000,000 for an entity), the SEC staff's March 2025 route. The combined exemption accepts either.
- `invest` holds USDC in escrow; `finalize` (anyone, once full or past the deadline) pays the company **everything raised** on success, or opens refunds. There is no admin withdrawal path.
- `claim_tokens` creates the trustline, authorizes and mints exactly `contribution / price`, the only mint path. **During lock-up** it locks the tokens straight into the vault in the same call (the investor's single signature covers the nested lock) and deauthorizes the wallet, so tokens earn dividends but can't move; `release` lifts that freeze after the date (a compliance freeze survives it).
- `authorize_holder` admits new holders after lock-up, if eligible for the exemption and under the cap.
- `freeze_holder`, `unfreeze_holder` (not during lock-up), `clawback` and `set_raise_compliance` belong to the raise's compliance account; each emits a `ComplianceAction` event with its reason.

### vault: locks and dividends
- Per share token: a reward-per-token accumulator (×1e18), `active_total` (earning this period), `pending_total` (earning from the next) and the accumulator at each period start.
- `lock` makes tokens pending; `unlock` returns pending first, and active tokens unlocked mid-period earn nothing for it.
- `start_period` bootstraps the first period; afterwards `distribute(token, from, amount)` pays the period and starts the next. `claim` pays settled USDC.
- Every call costs the same however many holders there are; there is no loop over holders.

## Off-chain pieces

| Piece | Role |
|---|---|
| Identity check (Didit) | Hosted ID document, liveness and face-match check, tied to the investor's Stellar address. Our server reads the decision from Didit's API, takes the residence country (proof of address, the address on the ID, or on testnet the document's country; any US document or nationality counts as US), issues the credential once per ID document, and deletes the Didit session with privacy erasure once the wallet's proof is registered on Stellar. |
| Sanctions screening | Wallet addresses checked against every digital-currency address on OFAC's SDN list (cached daily, fails closed) at credential issuance, accreditation and investing. |
| Browser prover | `app/public/zk/residence.wasm` + `residence_final.zkey` with snarkjs. Private inputs never leave the device. The Merkle tree is rebuilt from contract events, or from Horizon's history of `add_credential` calls once events age out of the RPC, and checked against the gate's count and root. |
| Company verification | DNS TXT record (`dvdnd-verify=<id>:<owner>`) over DNS-over-HTTPS, plus the GLEIF LEI registry. The evidence hash is stored in `registry`. |
| Compliance console | Holders from Horizon (`/accounts?asset=…`, with authorization flags) and vault positions; the audit log from the compliance accounts' Horizon history. |
| `stellar.toml` (SEP-1) | Generated from the chain: every share token with its exemption, restriction date and fixed supply. |
| Money in and out | Demo: XLM → USDC path payment on the DEX. Production: anchors (SEP-24) and Circle Mint. |

## Trust and limits
- The profit-share agreement is enforced legally, off-chain. The chain records its hash and every payout.
- The platform key can add credentials and verify companies. Registry and offering admin belong to a `timelock` contract whose proposer is the council (2-of-3): every admin change is scheduled on-chain and can only execute after the delay (10 minutes on testnet).
- The trusted setup has one phase-2 contributor so far; more independent contributions are needed before production.
- Proof of address and name-based AML screening need Didit's paid workflow; on testnet residence can fall back to the ID document's country.
- Eligibility lasts a year after proving, regardless of when the credential itself expires.
