# Stellar Classic Asset Primitives, Compliance Features, Soroban Bridging, and RWA Precedents (as of Oct 2026)

Scope: which native Stellar features can implement (1) compliance-gated company share tokens (non-US, KYC'd investors only), (2) pro-rata USDC dividends to locked holders, (3) trading on the native DEX/AMM, (4) graduation from a bonding curve to a real liquidity pool. Research date 2026-10-25. Items marked [VERIFY] may be outdated or come from secondary sources.

## 1. Classic asset issuance and holder gating (flags, trustlines, clawback)

### Takeaway
Classic Stellar assets come with protocol-level compliance controls. An issuer sets `AUTH_REQUIRED` + `AUTH_REVOCABLE` (+ optionally `AUTH_CLAWBACK_ENABLED`) on the issuing account, then approves each KYC'd holder's trustline with `SetTrustLineFlags`. That is a native allowlist enforced by the protocol: an unauthorized account cannot receive the asset at all. Jurisdiction rules ("non-US only") are not on-chain. They are enforced off-chain by the issuer's KYC process before it authorizes a trustline, and can be re-checked per transaction with SEP-8.

### Cited Findings
- **Issuer/distributor pattern:** docs recommend a separate issuing account (mints, holds the asset's identity) and distribution account (gets the first units and does day-to-day transfers). If the issuer is compromised an attacker can mint unlimited supply; a compromised distributor can be frozen and replaced without changing the issuer. An issuer cannot hold its own asset: sending it back to the issuer burns it. — [Stellar Docs: Control asset access](https://developers.stellar.org/docs/tokens/control-asset-access)
- **Fixed supply:** set the issuer's master weight to 0 after distribution. This permanently locks the account (no signing, no signer changes, no home-domain changes). If the asset has a SAC, its admin must still be the issuer. — [Stellar Docs: Control asset access](https://developers.stellar.org/docs/tokens/control-asset-access)
- **Account flags (set with `SetOptions`, can be set at any time):** `AUTH_REQUIRED` (0x1): issuer must approve each account before it can hold the asset. `AUTH_REVOCABLE` (0x2): issuer can revoke or reduce an existing trustline's authorization. `AUTH_IMMUTABLE` (0x4): blocks setting AUTH_REQUIRED/AUTH_REVOCABLE and blocks merging the issuer. `AUTH_CLAWBACK_ENABLED` (0x8): applies only to trustlines created after it is set, and requires AUTH_REVOCABLE. — [Stellar Docs: Control asset access](https://developers.stellar.org/docs/tokens/control-asset-access)
- **Trustline authorization levels (`SetTrustLineFlags`):** `AUTHORIZED` = full use (payments, offers, LP deposits). `AUTHORIZED_TO_MAINTAIN_LIABILITIES` = can keep existing offers, cancel offers or withdraw from a pool, but cannot otherwise transact. Full revocation freezes the asset and cancels open offers. Reducing to maintain-liabilities blocks transfers but does not cancel offers. — [Stellar Docs: Control asset access](https://developers.stellar.org/docs/tokens/control-asset-access)
- **CAP-35 Asset Clawback (Protocol 17, Final):**
  - `ClawbackOp` burns a specified amount (partial clawback allowed) from a holder without their signature. Medium threshold. Fails if the amount exceeds the balance available after selling liabilities.
  - `ClawbackClaimableBalanceOp` burns an entire claimable balance; the source must be the issuer.
  - `SetTrustLineFlagsOp` (low threshold) replaces the deprecated `AllowTrustOp`.
  - Flags: `TRUSTLINE_CLAWBACK_ENABLED_FLAG` is set at trustline creation if the issuer has clawback on. It can be cleared per trustline but never set via SetTrustLineFlags. `CLAIMABLE_BALANCE_CLAWBACK_ENABLED_FLAG` is inherited from the creator's trustline, or from the issuer's account flag when the issuer creates the balance.
  - Toggling AUTH_REVOCABLE while clawback is enabled fails with `SET_OPTIONS_AUTH_REVOCABLE_REQUIRED`.
  - — [CAP-35](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0035.md)
- Clawback-enabled assets are visibly flagged on the public ledger. SDF positions clawback for regulatory compliance, fraud recovery and lost-key recovery. — [Stellar blog: asset clawback](https://stellar.org/blog/developers/using-protocol-17s-asset-clawback)
- **"Authorization sandwich":** in one atomic transaction, the issuer fully authorizes both accounts, the payment runs, and then both are reduced back to maintain-liabilities. This authorizes only that pre-approved transfer. — [Stellar Docs: Control asset access](https://developers.stellar.org/docs/tokens/control-asset-access)
- **Reserves:** each trustline is a subentry costing 1 base reserve (0.5 XLM). Account minimum is 2 base reserves (1 XLM). Max 1,000 subentries per account. — [Stellar Docs: Lumens](https://developers.stellar.org/docs/learn/fundamentals/lumens)

### Inferences
- **Recommended share-token configuration:** `AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED`, set before any holder trustline exists, since clawback only applies to later trustlines. Do NOT set `AUTH_IMMUTABLE`.
  - Gating flow: off-chain KYC that includes a non-US residency attestation, then the issuer (or a delegated signer with low threshold) authorizes the trustline with `SetTrustLineFlags`.
  - Removing a holder: revoke authorization, or claw back and reissue for court orders or lost keys.
- **"Locked" holders without Soroban:** demoting a trustline to `AUTHORIZED_TO_MAINTAIN_LIABILITIES` freezes transfers but keeps the balance. That is a crude protocol-native lock. The issuer can then snapshot balances for dividends.
- **Two modes for full-auth vs sandwich:**
  - Fully authorizing every KYC'd holder allows free peer-to-peer trading among allowlisted accounts.
  - The SEP-8 sandwich allows per-transaction policy checks (e.g., holding limits, lockups).

### Gaps
- No protocol-native jurisdiction attribute exists. The "non-US" rule is entirely off-chain KYC policy (SEP-12 data) plus issuer authorization. I found no Stellar-native identity-claim registry comparable to ERC-3643's ONCHAINID.

## 2. SEP-8 Regulated Assets (approval server) and 2026 adoption

### Takeaway
SEP-8 (Active, v1.7.4, last updated 2022-02-21) standardizes a per-transaction issuer approval server built on AUTH_REQUIRED + AUTH_REVOCABLE and the authorization sandwich. It is the closest native analogue to transfer hooks for classic assets. I found no evidence of broad wallet support in 2026, and major RWA issuers appear to rely on plain trustline authorization (allowlisting) instead.

### Cited Findings
- **Requirements and discovery:** the issuer must set both Authorization Required and Authorization Revocable. In `stellar.toml` `[[CURRENCIES]]`, the issuer adds `regulated=true`, `approval_server` (URL) and `approval_criteria` (human-readable). — [SEP-8](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0008.md)
- **Approval endpoint:** a single POST endpoint receives `tx` (base64 envelope XDR), as form or JSON, with CORS. `/tx_approve` is only the spec's example path. The server signs compliant transactions but does not submit them; the wallet does. — [SEP-8](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0008.md)
- **Response statuses:**
  - `success` (200): signed unchanged.
  - `revised` (200): ops added (e.g., the auth sandwich) without changing intent; the user re-reviews and re-signs.
  - `pending` (200): includes `timeout` in milliseconds.
  - `action_required` (200): includes `action_url`, plus optional `action_fields` that reference SEP-9 KYC fields.
  - `rejected` (400): includes `error`.
  - — [SEP-8](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0008.md)
- **Sandwich guarantee:** because the transaction is atomic, "there will be no point where the clients' accounts have open, authorized trustlines" for unapproved operations. The spec text still describes this with AllowTrust and references CAP-18 for finer-grained control. — [SEP-8](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0008.md)

### Inferences
- **What SEP-8 adds:** it gives the platform transfer-time policy enforcement (non-US check, lockups, max holders) on classic DEX trades and payments.
- **Costs:** every transfer needs a round trip to the platform's server and a co-signature. That breaks permissionless composability: SDEX offers and AMM deposits do not work naturally when trustlines sit at maintain-liabilities by default.
- **For a pool "graduation" design:** SEP-8 assets are a poor fit for the native AMM, since pool participation requires fully AUTHORIZED trustlines (section 4).

### Gaps
- No 2026 adoption statistics for SEP-8 found (which wallets support it, which issuers use it). [VERIFY] SDF's reference implementation (the `stellar/java-stellar-anchor-sdk` and the older Go `regulated-assets-approval-server`) and its maintenance status not checked.

## 3. Stellar Asset Contract (SAC): classic assets in Soroban; protocol timeline

### Takeaway
Every classic asset can have a deployed SAC that exposes it as a SEP-41 token plus admin functions:
- Admin: `set_admin`, `set_authorized`, `authorized`, `mint`, `clawback`, `admin`, and, since Protocol 26 (CAP-73), `trust`.
- SEP-41: `transfer`, `transfer_from`, `approve`, `allowance`, `balance`, `burn`, `burn_from`, `decimals`, `name`, `symbol`.

The SAC enforces the classic auth and clawback flags but has no transfer hooks. Any custom compliance logic (lockups, snapshots) needs a wrapper or vault contract, or a custom SEP-41 token instead of a classic asset.

### Cited Findings
- **Functions:** `set_admin` (the issuer is the initial admin, changeable), `set_authorized`, `authorized`, `mint`, `clawback` (burns the amount), `trust` (creates the asset's unlimited trustline for a G-address), `admin`; plus the SEP-41 set listed above. There is no `asset()` or `issuer()` accessor. — [Stellar Docs: SAC](https://developers.stellar.org/docs/tokens/stellar-asset-contract)
- **Flag enforcement for G-accounts:** the balance must exist as a trustline. Transfers succeed only if the trustline has `AUTHORIZED_FLAG`. Clawback needs `TRUSTLINE_CLAWBACK_ENABLED_FLAG`. Transfers to the issuer burn and transfers from the issuer mint. — [Stellar Docs: SAC](https://developers.stellar.org/docs/tokens/stellar-asset-contract)
- **Flag enforcement for C-addresses (contracts):** balances and authorization live in contract storage, not trustlines. If `AUTH_REQUIRED` is set, the contract must be authorized before it can receive a balance. Clawback works only if `AUTH_CLAWBACK_ENABLED` was set on the issuer when the balance was created. Revocation needs `AUTH_REVOCABLE`. Deauthorizing a trustline via SAC clears AUTHORIZED and sets AUTHORIZED_TO_MAINTAIN_LIABILITIES. — [Stellar Docs: SAC](https://developers.stellar.org/docs/tokens/stellar-asset-contract)
- **`trust` (Protocol 26 Yardstick, CAP-73):** lets a contract create a G-account's trustline during an invocation. It is a no-op if the trustline exists or the address is a contract. It requires the account's auth when it actually creates one, and the account must cover the base reserve. — [Stellar Docs: SAC](https://developers.stellar.org/docs/tokens/stellar-asset-contract); [Software versions](https://developers.stellar.org/docs/networks/software-versions)
- **Limitations:**
  - No order-book functionality exposed via the SAC.
  - Trustline balances are signed 64-bit even though the interface takes i128; contract balances are 128-bit.
  - The native XLM SAC has no admin and cannot be burned.
  - Only `transfer` accepts a `MuxedAddress` (since Protocol 23 / CAP-67).
  - Verify a genuine SAC by its executable `CONTRACT_EXECUTABLE_STELLAR_ASSET`; the admin value alone proves nothing, since `set_admin` can change it.
  - — [Stellar Docs: SAC](https://developers.stellar.org/docs/tokens/stellar-asset-contract)
- **Protocol timeline (official software-versions page):**

| Protocol | Name | Mainnet date | Contents |
|---|---|---|---|
| 20 | Soroban Phase 0 | 2024-02-20 | Soroban activated |
| 21 | — | 2024-06-18 | CAP-51 secp256r1 (plus CAP-53/54/55/56) |
| 22 | — | 2024-12-05 | CAP-58 constructors; CAP-59 BLS12-381 |
| 23 | Whisk | 2025-09-03 | CAP-67 Unified Events; CAP-62/66 state archival |
| 24 | Stability | 2025-10-22 | No new features (fixes Whisk archival issues) |
| 25 | X-Ray | 2026-01-22 | CAP-74 BN254 ops; CAP-75 Poseidon/Poseidon2 |
| 26 | Yardstick | 2026-05-06 | CAP-73 SAC creates G-account balances/trustlines; CAP-77 freezing ledger entries via network config; CAP-78 limited TTL extension; CAP-79 muxed strkey conversions; CAP-80 efficient ZK BN254; CAP-82 checked 256-bit arithmetic |
| 27 | Zipper | 2026-07-08 | CAP-71 auth delegation and address-bound Soroban credentials |
| 28 | — | 2026-09-16 | CAP-83 validators can drop a ledger's tx set; CAP-85 externally managed contract executables; CAP-86 sparse symbol-keyed map host functions |
| 29 | — | 2026-10-01 | Security release, no CAPs |

  — [Stellar Docs: Software versions](https://developers.stellar.org/docs/networks/software-versions)
- X-Ray adds `bn254_g1_add`, `bn254_g1_mul` and `bn254_multi_pairing_check` (matching Ethereum EIP-196/197) plus Poseidon/Poseidon2 permutations, with no backward incompatibility. — [SDF X-Ray announcement](https://stellar.org/blog/developers/announcing-stellar-x-ray-protocol-25); [X-Ray upgrade guide](https://www.stellar.org/blog/stellar-x-ray-protocol-25-upgrade-guide)
- Yardstick went live on mainnet 2026-05-06 (testnet 2026-04-16). — [SDF Yardstick upgrade guide](https://stellar.org/blog/foundation-news/stellar-yardstick-protocol-26-upgrade-guide); [Blockchain.news](https://blockchain.news/news/stellar-protocol-26-upgrade-live-xlm)
- Smart-contract transactions are limited to 1 operation (plus 1 if fee-bumped). Classic transactions allow up to 100 operations. — [Stellar Docs: Fees](https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering)

### Inferences
- **Hybrid architecture:**
  - Issue the share as a classic asset (AUTH_REQUIRED/REVOCABLE/CLAWBACK) so it trades on the SDEX/AMM and shows in every wallet.
  - Deploy its SAC so a Soroban "staking/lock vault" holds shares as a C-address balance. The vault contract must itself be `set_authorized` because AUTH_REQUIRED applies to contracts too.
  - The vault records lock time and checkpoints for pro-rata dividends.
  - Since Protocol 26, a Soroban distributor can call `trust` to create holder trustlines inline, but only with holder auth plus a 0.5 XLM reserve per new trustline.
- **No hooks:** the SAC cannot run custom logic on `transfer`. The jurisdiction/lockup policy has to be enforced by (a) issuer trustline authorization, (b) the vault contract's own rules, or (c) a fully custom SEP-41 token. Option (c) gives up native SDEX/AMM trading.
- **Protocol 27 CAP-71** (auth delegation) may help with smart-wallet / custodial flows. Mechanics were not researched [VERIFY].

### Gaps
- CAP-67 Unified Events detail: it unifies classic and Soroban token events, so SAC-style `transfer`/`mint`/`burn`/`clawback` events are emitted for classic ops too. This comes from training knowledge and was not re-verified in this session [VERIFY].
- Exact Soroban resource fees per SAC transfer or `trust` call were not obtained. Use RPC `simulateTransaction`.

## 4. Native liquidity pools (CAP-38), SDEX order book and path payments

### Takeaway
The native AMM is a constant-product pool with a fixed 0.30% fee. Pool shares are non-transferable trustline balances, and participation needs fully authorized trustlines on both assets, so AUTH_REQUIRED shares can sit in a pool only for allowlisted LPs. Revoking an LP's auth force-withdraws them. Soroban contracts cannot deposit into or trade against classic pools. That makes the native pool a workable "graduation" target only if graduation is done by a classic account (an issuer/treasury G-account submitting `LiquidityPoolDeposit`), not by a contract. Path payments (`PathPaymentStrictSend`/`StrictReceive`) can convert any asset to USDC across the SDEX and AMMs atomically.

### Cited Findings
- **Pricing and fee:** constant-product; "AMMs on Stellar must never allow the product of the reserves to decrease." The fee is 30 bps on the amount bought by the AMM and is folded into the invariant, so reserves grow. — [Stellar Docs: Liquidity on Stellar](https://developers.stellar.org/docs/learn/fundamentals/liquidity-on-stellar-sdex-liquidity-pools)
- **Pool shares:**
  - They "cannot be transferred"; they change only via `LiquidityPoolDeposit` / `LiquidityPoolWithdraw`.
  - LPs need trustlines to both assets plus a pool-share trustline created with `ChangeTrust` (the asset pair goes in lexicographic order).
  - A pool-share trustline costs 2 base reserves (1 XLM) and cannot be created unless the account already has authorized trustlines to both assets.
  - — [Stellar Docs: Liquidity](https://developers.stellar.org/docs/learn/fundamentals/liquidity-on-stellar-sdex-liquidity-pools); [Lumens](https://developers.stellar.org/docs/learn/fundamentals/lumens)
- **Authorization:**
  - Pool-share trustlines can't be authorized independently; they derive from the underlying trustlines. If either underlying is only maintain-liabilities, the pool share is restricted too.
  - If an issuer revokes authorization, the account "will automatically withdraw from every liquidity pool containing that asset". The pool-share trustline is deleted and claimable balances are created for each withdrawn asset (BalanceID = SHA-256 of a revokeID).
  - — [Stellar Docs: Liquidity](https://developers.stellar.org/docs/learn/fundamentals/liquidity-on-stellar-sdex-liquidity-pools)
- **SDEX:**
  - Offers via `ManageBuyOffer`, `ManageSellOffer`, `CreatePassiveSellOffer`, with price-time priority.
  - Prices are fractions of 32-bit integers.
  - Passive offers allow zero-spread markets.
  - `PathPaymentStrictReceive` / `PathPaymentStrictSend` route across both SDEX and pools.
  - — [Stellar Docs: Liquidity](https://developers.stellar.org/docs/learn/fundamentals/liquidity-on-stellar-sdex-liquidity-pools)
- **Soroban interaction:** Soroban liquidity pools "cannot interact with built-in Stellar AMM liquidity pools". The SAC exposes no order-book functionality, and native PathPayment cannot route through Soroban liquidity. Soroban AMMs (Soroswap, a UniswapV2-style router; Aquarius, with volatile/stable/CLMM pools) are separate venues. — [Stellar Docs: liquidity pool example](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/liquidity-pool); [Stellar Docs: SAC](https://developers.stellar.org/docs/tokens/stellar-asset-contract); [SCF aggregator project](https://communityfund.stellar.org/project/lumagg-stellar-dex-aggregator-pnp)

### Inferences
- **Bonding curve then graduation:**
  - A bonding curve has to be a Soroban contract.
  - At graduation, the contract cannot deposit into a CAP-38 pool itself. Instead it releases share + USDC (via SAC transfers) to a platform-controlled G-account, which submits `ChangeTrust`(pool share) + `LiquidityPoolDeposit` in a classic transaction.
  - Pool shares are non-transferable and cannot be "burned" to a dead address. To lock liquidity permanently, deposit from an account whose signers are then removed (master weight 0). That account can never withdraw, but it also can never be revoked without force-withdrawal by the issuer, which is a trust consideration.
- **Alternative graduation target:** a Soroban AMM (Soroswap/Aquarius). It keeps contract composability (LP tokens are contract tokens) but loses native path-payment routing. Aggregators bridge both.
- **Fixed 0.30% fee:** this cannot be customized, so the platform cannot take an LP fee cut natively.
- **Compliance in pools:**
  - With AUTH_REQUIRED, traders must hold an authorized trustline to receive shares, so even AMM buyers must be allowlisted. Gating is preserved on the DEX.
  - Unauthorized holders can't even create the pool-share trustline.
  - SEP-8 sandwich-style assets (trustlines kept at maintain-liabilities) effectively cannot be pooled.
- **Dividend conversion:** a company can pay dividends in any asset. The platform's distributor runs `PathPaymentStrictSend` (send X, receive ≥ min USDC) or `PathPaymentStrictReceive` (receive exact USDC). It can even pay each holder directly with a path payment whose destination asset is USDC: up to 100 per classic transaction, with slippage bounds per op.

### Gaps
- Depth of USDC/XLM and other liquidity on native pools vs Soroban AMMs in 2026 not measured.
- Whether CAP-38 pools for AUTH_REQUIRED assets are used by any RWA issuer: no evidence found.

## 5. Claimable balances vs direct payments vs Soroban pull-claims for dividends

### Takeaway
Claimable balances (CAP-23) are a native, time-boundable "pull" airdrop. Each entry locks 0.5 XLM per claimant (returned to the creator on claim), costs a 100-stroop op fee, and allows ≤10 claimants, but any listed claimant can take the whole balance. Pro-rata dividends therefore need one entry per holder: up to 100 per classic transaction (1 op each), each locking 0.5 XLM until claimed or clawed back. For large holder sets, a Soroban merkle/snapshot claim contract avoids per-holder reserves but costs Soroban resource fees per claim.

### Cited Findings
- **Operations and predicates:** `CreateClaimableBalance`, `ClaimClaimableBalance`, `ClawbackClaimableBalance` (entire balance only). Predicates: `UNCONDITIONAL`, `BEFORE_ABSOLUTE_TIME`, `BEFORE_RELATIVE_TIME`, `NOT`, `AND`, `OR`, nestable (e.g., NOT(before T) = claimable after T). The claimant must hold a trustline to the asset, otherwise `op_no_trust`. — [Stellar Docs: Claimable balances](https://developers.stellar.org/docs/build/guides/transactions/claimable-balances)
- **CAP-23 limits:**
  - `Claimant claimants<10>`: max 10 claimants, non-empty, no duplicate destinations.
  - Reserve = `claimants.size() * baseReserve`, deducted from the creator.
  - On claim, the reserve returns to `createdBy` if that account exists and has native limit; otherwise it goes to the claimant.
  - Result codes include `CREATE_CLAIMABLE_BALANCE_NOT_AUTHORIZED` (-4) and `CLAIM_CLAIMABLE_BALANCE_NOT_AUTHORIZED` (-5), so auth-required assets enforce authorization at both create and claim time.
  - — [CAP-23](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0023.md)
- **Clawback:** claimable balances inherit `CLAIMABLE_BALANCE_CLAWBACK_ENABLED_FLAG` from the creator's trustline. — [CAP-35](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0035.md)
- **Costs:** base reserve 0.5 XLM; "a base reserve per claimant". Minimum inclusion fee is 100 stroops per op. Classic transactions take up to 100 ops. Soroban transactions take 1 op and pay inclusion + resource fees (CPU, entry access, I/O, tx size, events, rent). Mainnet ledger capacity (July 2026): 1,000 classic ops and 2,000 smart-contract transactions per ledger. — [Lumens](https://developers.stellar.org/docs/learn/fundamentals/lumens); [Fees](https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering)

### Inferences (cost model; XLM price ~$0.18 per [Cointelegraph, Aug 2026](https://cointelegraph.com/news/stellar-tokenized-rwa-market-nears-4b-after-fourfold-2026-growth))
- **(a) Push via `Payment`:** USDC to N holders costs N × 100 stroops. 1,000 holders = 0.01 XLM in fees across 10 transactions. No reserve is locked, but every holder needs an existing USDC trustline, otherwise the op fails. Cheapest for small or medium N.
- **(b) Claimable balances:** 1,000 holders lock 500 XLM (~$90) until claimed; reserves come back to the creator on claim. Works for holders without a USDC trustline yet (they add one, then claim). A time predicate gives expiry, after which the issuer reclaims, provided the issuer/creator is also listed as a claimant with a NOT(before T) predicate.
- **(c) Soroban merkle/snapshot claim:**
  - One storage write of the root per dividend round. Each claim is its own Soroban transaction (claimant pays the resource fee, or the platform sponsors it via fee-bump).
  - Needs a per-claimant "claimed" bitmap entry, which incurs rent.
  - Scales to any N with O(1) issuer cost. Best fit when holders are "locked" in a Soroban vault, since the vault can compute pro-rata entitlements from checkpoints directly with no merkle tree needed.
- For locked holders inside a Soroban vault, (c) or an in-vault accumulator (rewards-per-share pattern) is the natural design. (a) suits classic-account holders.

### Gaps
- Exact Soroban fee in XLM for a typical merkle-claim plus SAC transfer was not found. Simulate on testnet.
- Whether claimable-balance sponsorship (CAP-33) can shift reserves: not verified here.

## 6. SEP-10, SEP-45, SEP-12, SEP-41

### Takeaway
SEP-10 (G/M accounts) and SEP-45 (C contract accounts, still Draft) provide wallet-signature web auth (JWT) for KYC sessions. SEP-12 is the KYC data-exchange API (built on SEP-9 fields). SEP-41 is the Soroban token interface that the SAC implements. A platform supporting smart wallets needs both SEP-10 and SEP-45.

### Cited Findings
- **SEP-45 discovery and flow:**
  - Status Draft, v0.1.1 (updated 2025-12-16).
  - `stellar.toml` publishes `WEB_AUTH_FOR_CONTRACTS_ENDPOINT`, `WEB_AUTH_CONTRACT_ID` and `SIGNING_KEY`.
  - The server returns Soroban authorization entries that call `web_auth_verify` (account, home domain, server domain, nonce). The client signs its entry, and the server simulates it and returns a JWT whose `sub` is the C-address.
  - Supports optional client domain. Uses nonces plus signature expiration ledgers for replay protection.
  - — [SEP-45](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0045.md)
- SEP-45 is based on SEP-10 but does not replace it: SEP-45 covers only C accounts, SEP-10 covers G and M. Services accepting all account types should implement both. The motivating example is uploading KYC via SEP-12. — [SEP-45](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0045.md)
- SEP-8 `action_required` responses can reference SEP-9 KYC fields, which links regulated-asset approval to KYC collection. — [SEP-8](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0008.md)
- The SEP-41 function set is implemented by the SAC (listed in section 3). — [Stellar Docs: SAC](https://developers.stellar.org/docs/tokens/stellar-asset-contract)

### Gaps
- SEP-12 and SEP-10 spec versions and statuses were not re-fetched this session. They are long-standing Active SEPs per prior knowledge [VERIFY].

## 7. RWA precedents on Stellar and market size

### Takeaway
Stellar's tokenized-RWA market was about $3.996B on 2026-08-29, up ~360% from $868.8M at end-2025 (Stellar Dune dashboard). It is led by Spiko (~$1.55B), then Realiz, Tradable, Franklin Templeton and Ondo (~$535–559M each). Precedents are mostly treasuries, MMFs, sovereign debt and private credit. No live tokenized equity was found: DTCC's DTC-tokenized Russell 1000 stocks/ETFs on Stellar are planned for H1 2027. Compliance is typically issuer-allowlisting (auth-required trustlines) plus clawback, with transfer agents reconciling off-chain.

### Cited Findings
- **Market size:** $3.996B on Aug 29, 2026, +360% YTD from $868.8M. The figure comes from a Stellar Dune dashboard, not directly rwa.xyz. Spiko ~$1.55B; Realiz, Tradable, Franklin Templeton and Ondo each ~$535–559M. — [Cointelegraph](https://cointelegraph.com/news/stellar-tokenized-rwa-market-nears-4b-after-fourfold-2026-growth); [CoinPaprika](https://coinpaprika.com/news/stellars-tokenized-rwa-market-quadruples/). One outlet printed the end-2025 base as $8.688B, likely a typo — [KuCoin flash](https://www.kucoin.com/news/flash/stellar-s-tokenized-rwa-market-surpasses-3-996b-up-360-in-2026)
- Per SDF citing rwa.xyz, Stellar held ~$490M of non-US government debt (Etherfuse CETES, Brazilian bonds) as of Aug 20, 2026, reportedly more than any other public chain. — [Cointelegraph](https://cointelegraph.com/news/stellar-tokenized-rwa-market-nears-4b-after-fourfold-2026-growth)
- An earlier SDF report listed 10 regulated RWA issuers including Spiko, with 67 products totaling $1.4B. [Older snapshot] — [SDF Institutional Infrastructure Report](https://stellar.org/resources/institutional-infrastructure-report)
- **Franklin Templeton BENJI / FOBXX:**
  - Stellar was the original chain.
  - On Aug 12, 2026, SEC staff issued no-action relief letting Franklin's registered funds hold BENJI shares (Investment Company Act §17(f) / Rule 17f-2). — [The Block](https://theblock.co/news/defi/2026-08-12-sec-clears-franklin-templeton-funds-use-onchain-benji-system-cash-management-411654)
  - Per a secondary explainer: only allowlisted addresses can hold BENJI; the transfer agent burns and mints for cross-chain moves and reconciles on-chain balances daily with the official register [secondary, VERIFY]. — [eco.com](https://eco.com/support/en/articles/15254016-benji-deep-dive-2026-franklin-templeton-s-tokenized-money-market)
- **Ondo USDY:** launched on Stellar Sept 17, 2025 (tokenized US Treasuries, yield-bearing). SDF's announcement also names WisdomTree Prime among issuers using Stellar's "built-in features and controls". — [Stellar press: Ondo USDY](https://stellar.org/press/ondo-finance-launches-usdy-on-stellar); [SDF blog](https://stellar.org/blog/foundation-news/welcoming-ondo-s-usdy-to-the-stellar-network)
- **PayPal PYUSD:** announced June 11, 2025 (pending NYDFS approval); live on Stellar Sept 18, 2025. — [PayPal PR](https://s205.q4cdn.com/875401827/files/doc_news/PayPal-USD-PYUSD-Plans-to-Use-Stellar-for-New-Use-Cases-2025.pdf); [Stellar press](https://stellar.org/press/paypal-pyusd-is-now-available-on-stellar)
- **Centrifuge deRWA:** launched on Stellar with $20M into deJTRSY (Janus Henderson short-term Treasuries) and deJAAA (AAA CLO). Centrifuge share tokens support identity management, transfer restrictions, freeze and clawback, and investor whitelisting. Hooks can require KYC for vault interactions while allowing free secondary transfers. That last design is relevant: KYC on primary subscription and redemption, with open secondary trading. — [Stellar press: Centrifuge](https://stellar.org/press/centrifuge-brings-derwa-to-stellar-launching-with-usd20m-into-dejtrsy-and-dejaaa); [Centrifuge docs: token compliance](https://docs.centrifuge.io/developer/protocol/features/token-compliance/)
- **Etherfuse Stablebonds:** CETES tokenized Mexican T-bills issued on Stellar, paired with the MXNe peso stablecoin (with Brale); Anchorage custody support. The company reports 175M+ Stablebonds purchased. CETES is multichain (also Solana, Base, Polygon, Monad). — [Fintech Times](https://thefintechtimes.com/anchorage-digital-adds-custody-for-tokenized-mexican-sovereign-debt/); [Stellar i-Awards 2025](https://stellar.org/blog/ecosystem/stellar-i-awards-2025); [DefiLlama](https://defillama.com/rwa/asset/cetes)
- **Tradable (private credit):** July 15, 2026 plan to bring up to $1B of private credit to Stellar; it previously tokenized $1.7B across ~30 positions on ZKsync. — [The Block](https://www.theblock.co/post/408399/tokenization-startup-tradable-plans-bring-1-billion-private-credit-assets-stellar); [Cointelegraph](https://cointelegraph.com/news/tradables-1b-stellar-deal-adds-to-institutional-tokenization-boom). By Aug 2026 Tradable appears among the ~$535–559M top issuers on Stellar — [Cointelegraph](https://cointelegraph.com/news/stellar-tokenized-rwa-market-nears-4b-after-fourfold-2026-growth)
- **Tokenized equities (DTCC):** announced May 27, 2026, DTC's tokenization service will add Stellar as its second public blockchain, covering Russell 1000 stocks, major ETFs and Treasuries, targeted for H1 2027. It rests on a Dec 2025 SEC no-action letter to DTC. — [Ledger Insights](https://www.ledgerinsights.com/dtc-tokenization-service-to-add-stellar-as-second-public-blockchain/); [RWA Times](https://rwatimes.substack.com/p/stellar-becomes-first-public-blockchain)
- **Liqvid:** an SCF grant proposal for compliant RWA issuance with Soroban or L1 investor access control, targeting $5–10M first deals. Proposal only. — [SCF submission](https://communityfund.stellar.org/submissions/rec2aZKPZ8SmvFoGS)
- **Cross-chain context:** RWA.xyz puts the total tokenized RWA sector above $34B, with private credit ~44% per Bernstein. — [Cointelegraph](https://cointelegraph.com/news/tradables-1b-stellar-deal-adds-to-institutional-tokenization-boom)

### Inferences
- **The dominant Stellar RWA compliance pattern:** classic asset + issuer allowlisting (auth-required trustlines) + clawback/revocation, with off-chain transfer-agent books of record. Centrifuge adds contract-level hooks on Soroban. A private-equity share token following the BENJI/Spiko pattern on classic rails is consistent with precedent.
- **Equity is new ground:** no live tokenized private equity or dividend-paying equity on Stellar was found. Tokenized equity on Stellar is still forthcoming (DTCC 2027), so the platform would be early. Securities-law structure (e.g., Reg S for non-US-only offerings) matters more than tech.

### Gaps
- No rwa.xyz page for Stellar fetched directly (figures via the Stellar Dune dashboard as reported by press). Spiko and Realiz Stellar-specific compliance mechanics not found. WisdomTree Prime's Stellar product details and dates not found.
- Circle USDC on Stellar issuer flag configuration (e.g., whether revocable or clawback-enabled) not verified this session. Check the USDC issuer account on stellar.expert before assuming dividend USDC could be frozen.
- I found no tokenized private-equity or dividend-distribution precedent on Stellar.
