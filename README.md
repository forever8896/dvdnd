# dvdnd

**Own a share of real, profitable businesses. Get paid in dollars.**

dvdnd is tokenized private equity on Stellar. Profitable small and mid-sized businesses raise USDC at a fixed price by selling a share of their future profits. Investors who lock their tokens for a full period receive that period's dividends in USDC, pro-rata. Investors prove they are not US residents with a zero-knowledge proof, and the Stellar protocol itself then limits holding the token to verified investors.

**Live demo (Stellar testnet): https://dvdnd.vercel.app**

Built for HackMeridian · Genesis track · Stellar Unlocked.

## The problem

Sophisticated capital keeps moving from public markets into private, cash-flowing businesses, but ordinary investors can't get in. Crypto's answer so far has been the memecoin launchpad:
- About 1% of pump.fun tokens ever graduate (0.63% in Sep 2025, 1.89% lifetime to May 2026).
- About 60% of active wallets lost money over six months.
- Bonding curves let the first buyer pay up to 14.7× less than the last.

Real businesses, meanwhile, struggle to raise growth capital without giving up control or taking on debt.

## How dvdnd works

1. **A company signs up.** It proves it owns the business (company registry match and domain check) and signs an agreement committing X% of yearly net profit to token holders. The agreement's hash is recorded on-chain.
2. **The company opens a fixed-price raise.** It sets a price (for example 1.00 USDC per token, set from a target yield), a minimum, a maximum and a deadline.
3. **Verified investors put USDC into escrow.**
   - If the minimum is reached, the company receives the raise minus a 5% platform fee, and investors claim their tokens.
   - If it isn't, everyone is refunded automatically.
4. **Holders trade with each other afterwards.** Only verified investors can hold the token, on Stellar's built-in order book and through path payments.
5. **Dividends.**
   - Holders lock tokens in the vault.
   - At the end of each period the company pays X% of its profit in USDC.
   - Only tokens locked for the whole period share it, so locking right before a payout earns nothing.

Money flows to the company once, at the raise, and back to holders as dividends from real profits. There is no bonding curve, no sniper advantage and no company buyback.

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
| registry | [`CDWUC63EYRCEVQISAN7MZNAAOMT76VW6PTSVIUXTX3PDPXWJBNWJFJXY`](https://stellar.expert/explorer/testnet/contract/CDWUC63EYRCEVQISAN7MZNAAOMT76VW6PTSVIUXTX3PDPXWJBNWJFJXY) |
| gate | [`CBPU52XUHU4UQ3MUBOXITFNHQMOON3SDEWN2IVKPGRCZSQTRTCLGDB7N`](https://stellar.expert/explorer/testnet/contract/CBPU52XUHU4UQ3MUBOXITFNHQMOON3SDEWN2IVKPGRCZSQTRTCLGDB7N) |
| offering | [`CB5EJPS7K33FE3IGEFW6VINJD5MBL3HJ32I2JOAN34AMICBW73MZED3L`](https://stellar.expert/explorer/testnet/contract/CB5EJPS7K33FE3IGEFW6VINJD5MBL3HJ32I2JOAN34AMICBW73MZED3L) |
| vault | [`CCTY5CZFMXTBH4EPWKFHRVWDEHOFVEEWE3EPOGJEPKR65AJIG5CFLWX4`](https://stellar.expert/explorer/testnet/contract/CCTY5CZFMXTBH4EPWKFHRVWDEHOFVEEWE3EPOGJEPKR65AJIG5CFLWX4) |
| USDC (Circle testnet) | [`CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`](https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA) |

A complete cycle ran on testnet: ZK eligibility, raise, 5% fee, token claims, locks, and an 80 USDC dividend split 60/20 by locked amount. Every transaction link is in [deployments/evidence.md](deployments/evidence.md).

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
for k in admin treasury company-andes issuer-andes investor-ana investor-ben; do
  stellar keys generate $k --network testnet --fund
done

scripts/testnet/deploy.sh                                    # deploy all four contracts
scripts/testnet/demo-company.sh ANDES company-andes issuer-andes \
  "Andes Craft Brewing" 152 5000 300 1000 259200             # issue token, verify, sign, open raise
scripts/testnet/demo-investor.sh investor-ana 620 800       # Portugal: credential, ZK proof, USDC
scripts/testnet/demo-investor.sh investor-ben 276 600       # Germany
scripts/testnet/demo-lifecycle.sh ANDES company-andes investor-ana 600 investor-ben 400 80
```

### Click through it in the app

Open https://dvdnd.vercel.app, or run it locally:

```sh
cd app
echo "DVDND_ADMIN_SECRET=$(stellar keys show admin)" > .env.local   # testnet issuer key for the mock KYC/KYB routes
pnpm install && pnpm dev                                           # http://localhost:3000
```

1. **Investor:** Sign in → I'm an investor (a testnet wallet is created in your browser and funded with test XLM) → verify residence (mock KYC, then a real Groth16 proof generated in the browser and verified on-chain) → Discover → open a raise → Invest (Add money swaps test XLM for Circle testnet USDC).
2. **Company:** Sign in → I'm raising for my company → register → verify ownership → sign the agreement → Set up raise (issues the share token with compliance flags and opens the raise).
3. **Close and pay:** once a raise is full or past its deadline, anyone can close it → investors claim tokens in Portfolio and lock them → the company starts the first period and pays a dividend → investors claim USDC.

| Variable | Where | Purpose |
|---|---|---|
| `DVDND_ADMIN_SECRET` | server only (`app/.env.local`) | Testnet platform key used by `/api/kyc` (adds credential leaves to the gate) and `/api/kyb` (verifies companies in the registry). |
| `NEXT_PUBLIC_REGISTRY`, `NEXT_PUBLIC_GATE`, `NEXT_PUBLIC_OFFERING`, `NEXT_PUBLIC_VAULT`, `NEXT_PUBLIC_USDC_SAC` | optional | Override the testnet contract IDs (defaults in `app/src/lib/config.ts`). |
| `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_HORIZON_URL` | optional | Override the testnet RPC / Horizon endpoints. |

Live tests against testnet (with the app running): `LIVE=1 APP_URL=http://localhost:3000 pnpm vitest run` in `app/`.

## Built during HackMeridian

Everything in this repository was built during the event, starting 25 October 2026: research, contracts, circuit, scripts and app. No prior code was reused. The circuit's trusted setup is a single-contributor development setup and is not secure for production.

## License

MIT
