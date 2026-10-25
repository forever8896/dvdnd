# dvdnd

**Own a share of real, profitable businesses. Get paid in dollars.**

dvdnd is tokenized private equity on Stellar. Profitable small and mid-sized businesses raise USDC at a fixed price by selling a share of their future profits. Investors who lock their tokens for a full period receive that period's dividends in USDC, pro-rata. Each raise runs under a securities exemption: **Reg S** (investors prove with a zero-knowledge proof that they live outside the US), **Reg D 506(c)** (verified accredited investors, US residents included), or both side by side. The Stellar protocol itself then limits holding the token to eligible investors.

**Live demo (Stellar testnet): https://dvdnd.vercel.app**

Built for HackMeridian · Genesis track · Stellar Unlocked.

## The problem

Sophisticated capital keeps moving from public markets into private, cash-flowing businesses, but ordinary investors can't get in. Crypto's answer so far has been the memecoin launchpad:
- About 1% of pump.fun tokens ever graduate (0.63% in Sep 2025, 1.89% lifetime to May 2026).
- About 60% of active wallets lost money over six months.
- Bonding curves let the first buyer pay up to 14.7× less than the last.

Real businesses, meanwhile, struggle to raise growth capital without giving up control or taking on debt.

## How dvdnd works

1. **A company signs up.** It proves it owns the business (domain check, plus GLEIF when it has an LEI) and signs an agreement committing X% of yearly net profit to token holders. The agreement's hash is recorded on-chain.
2. **The company opens a fixed-price raise** and pays a flat listing fee. It sets a price (for example 1.00 USDC per token, set from a target yield), a minimum, a maximum and a deadline, plus the raise's rules: exemption (Reg S, 506(c) or both), minimum investment, holder cap, lock-up date, and who holds the compliance role (the company or its transfer agent).
3. **Eligible investors put USDC into escrow.**
   - **Reg S:** identity checked once through Didit (ID document and live selfie), then a zero-knowledge proof of non-US residence verified on-chain.
   - **506(c):** a signed accreditation statement on-chain (as a person or an entity), plus either a verifier's attestation or at least 200,000 USDC invested, 1,000,000 for an entity (the SEC staff's March 2025 route).
   - **Both:** proven non-US residents invest under Reg S, everyone else (including US residents) as accredited investors.
   - If the minimum is reached, the company receives everything raised and investors claim their tokens. If it isn't, everyone is refunded.
4. **Lock-up, then trading between eligible holders.** Until the lock-up date, claimed tokens sit in the dividend vault, earning, and the holder's wallet is frozen. Afterwards, holders release them and trade only with other eligible holders, on Stellar's order book and through path payments.
5. **Dividends.**
   - Holders lock tokens in the vault.
   - At the end of each period the company pays X% of its profit in USDC.
   - Only tokens locked for the whole period share it, so locking right before a payout earns nothing.

Money flows to the company once, at the raise, and back to holders as dividends from real profits. There is no bonding curve, no sniper advantage and no company buyback.

## Compliance model

dvdnd aims to be open compliance software, not a broker (draft strategy, not legal advice):
- **No transaction-based pay.** A flat listing fee per raise, never a share of what is raised (Securities Act §4(b)).
- **No control over investor money.** Escrowed USDC can only go to the company on success or back to investors on failure.
- **Gatekeeping per raise.** Each raise names its own compliance account, which alone can freeze, unfreeze or claw back, with a recorded reason.
- **Rules in the contract:** exemption-specific eligibility, the Reg D one-year lock-up (Rule 144), and a holder cap under the §12(g) trigger.

## Why Stellar (Stellar Unlocked)

| Protocol feature | How dvdnd uses it |
|---|---|
| **BN254 host functions** (CAP-74/80) | The `gate` contract verifies a Groth16 proof of non-US residence on-chain (`g1_msm` + `pairing_check`), about 30M CPU instructions. |
| **Poseidon host function** (CAP-75) | The `gate` keeps the KYC credential Merkle tree on-chain and hashes the investor's address into the proof, matching circomlib's Poseidon. |
| **Classic asset flags** | Each share token is issued with `AUTH_REQUIRED \| AUTH_REVOCABLE \| AUTH_CLAWBACK_ENABLED`, so the protocol rejects transfers to anyone not verified, on every venue. |
| **Stellar Asset Contract** | The `offering` contract is the share token's SAC admin. It mints exactly what was sold, authorizes verified holders and can never mint again. |
| **Path payments + DEX** | Investors pay with XLM and receive Circle USDC in one operation. Secondary trading runs on the order book. |

## Repository

| Path | Contents |
|---|---|
| [`contracts/`](contracts/) | Soroban contracts: `registry`, `gate`, `offering`, `vault` (Rust, soroban-sdk 28) |
| [`circuits/`](circuits/) | Circom residence circuit, trusted-setup scripts and browser/Node prover |
| [`scripts/testnet/`](scripts/testnet/) | Deploy and end-to-end demo scripts |
| [`deployments/`](deployments/) | Testnet contract IDs and [transaction evidence](deployments/evidence.md) |
| [`app/`](app/) | Next.js web app: investor and company flows wired to the testnet contracts |
| [`docs/`](docs/) | Design brief |
| [`research_notes/`](research_notes/), [`reports/`](reports/) | Research behind the design |

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit together.

## Testnet deployment

| Contract | ID |
|---|---|
| registry | [`CCL5K3BT7EKT47SLRIHL23AMKELXPY34WATWMRLKGW2ZWYOALE66Y2TZ`](https://stellar.expert/explorer/testnet/contract/CCL5K3BT7EKT47SLRIHL23AMKELXPY34WATWMRLKGW2ZWYOALE66Y2TZ) |
| gate | [`CBPU52XUHU4UQ3MUBOXITFNHQMOON3SDEWN2IVKPGRCZSQTRTCLGDB7N`](https://stellar.expert/explorer/testnet/contract/CBPU52XUHU4UQ3MUBOXITFNHQMOON3SDEWN2IVKPGRCZSQTRTCLGDB7N) |
| offering | [`CCJCRABWLOEOXVDRHSJXLS5HDOCUCZWY2X2N27NUP24H62N6DKYISX5P`](https://stellar.expert/explorer/testnet/contract/CCJCRABWLOEOXVDRHSJXLS5HDOCUCZWY2X2N27NUP24H62N6DKYISX5P) |
| vault | [`CDU5CGRWVSMFKQWRNJLP5XAKHQAF624QTLUNCONHJ4GQHOZOVAQROHKM`](https://stellar.expert/explorer/testnet/contract/CDU5CGRWVSMFKQWRNJLP5XAKHQAF624QTLUNCONHJ4GQHOZOVAQROHKM) |
| USDC (Circle testnet) | [`CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`](https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA) |

A complete cycle ran on testnet: ZK eligibility, raise, flat listing fee, token claims straight into the vault under lock-up, and an 80 USDC dividend split 60/40 by locked amount. The lock-up was checked on-chain: the frozen wallet can't unlock or move tokens. Every transaction link is in [deployments/evidence.md](deployments/evidence.md).

## Setup

Requirements: Rust 1.84+ with the `wasm32v1-none` target, [Stellar CLI](https://developers.stellar.org/docs/tools/cli) 28+, Node 20+, pnpm, and circom 2.2 (only to rebuild the circuit).

```sh
# Contracts: tests and wasm
cd contracts
cargo test
stellar contract build

# Circuit dependencies and prover
cd ../circuits
pnpm install
pnpm fixture            # build a sample proof and verify it off-chain

# Web app
cd ../app
pnpm install
pnpm dev
```

## Run the demo on testnet

```sh
# Funded testnet identities
for k in admin treasury company-andes issuer-andes company-harbor issuer-harbor investor-ana investor-ben; do
  stellar keys generate $k --network testnet --fund
done

scripts/testnet/council.sh                                   # 2-of-3 council (registry and offering admin)
scripts/testnet/deploy.sh                                    # deploy all four contracts
scripts/testnet/demo-company.sh ANDES company-andes issuer-andes \
  "Andes Craft Brewing" 152 5000 300 1000 259200             # issue token, verify, sign, open a Reg S raise
EXEMPTION=506c LOCKUP_SECS=31536000 VERIFIER=admin \
  scripts/testnet/demo-company.sh HARBOR company-harbor issuer-harbor \
  "Harbor & Hearth Bakeries" 620 5000 1000 5000 604800      # a 506(c) raise with a one-year lock-up
scripts/testnet/demo-investor.sh investor-ana 620 800       # Portugal: credential, ZK proof, USDC
scripts/testnet/demo-investor.sh investor-ben 276 600       # Germany
scripts/testnet/demo-lifecycle.sh ANDES company-andes investor-ana 600 investor-ben 400 80
```

### Click through it in the app

Open https://dvdnd.vercel.app, or run it locally:

```sh
cd app
cp .env.example .env.local   # then set DVDND_ADMIN_SECRET=$(stellar keys show admin) and the Didit keys
pnpm install && pnpm dev                                           # http://localhost:3000
```

1. **Investor (Reg S):** Sign in → I'm an investor → verify residence (Didit identity check with only the Stellar wallet; then a real Groth16 proof generated in the browser and verified on-chain) → Discover → open a raise → Invest (Add money swaps test XLM for Circle testnet USDC).
   **Investor (506(c)):** open the Harbor & Hearth raise → sign the accreditation statement → get verified by the testnet verifier → Invest.
2. **Company:** Sign in → I'm raising for my company → register → verify ownership → sign the agreement → Set up raise (issues the share token with compliance flags and opens the raise).
3. **Close and pay:** once a raise is full or past its deadline, anyone can close it → investors claim tokens in Portfolio and lock them → the company starts the first period and pays a dividend → investors claim USDC.

| Variable | Where | Purpose |
|---|---|---|
| `DVDND_ADMIN_SECRET` | server only (`app/.env.local`) | Testnet platform key used by `/api/kyc` (adds credential leaves to the gate) and `/api/kyb` (verifies companies in the registry). |
| `NEXT_PUBLIC_REGISTRY`, `NEXT_PUBLIC_GATE`, `NEXT_PUBLIC_OFFERING`, `NEXT_PUBLIC_VAULT`, `NEXT_PUBLIC_USDC_SAC` | optional | Override the testnet contract IDs (defaults in `app/src/lib/config.ts`). |
| `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_HORIZON_URL` | optional | Override the testnet RPC / Horizon endpoints. |

Live tests against testnet (with the app running): `LIVE=1 APP_URL=http://localhost:3000 pnpm vitest run` in `app/`.

## Built during HackMeridian

Everything in this repository was built during the event, starting 25 October 2026: research, contracts, circuit, scripts and app. No prior code was reused. The circuit's trusted setup uses the public PSE Powers of Tau and a recorded phase-2 ceremony (circuits/ceremony/TRANSCRIPT.md) with one contributor so far; more independent contributors are needed before production.

## License

MIT
