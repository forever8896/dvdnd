# Stellar Anchors and Fiat On/Off-Ramps for a Tokenized Private-Equity Dividend Platform

Research date: 2026-10-25. About 20 tool calls. Several primary sites blocked the fetches (anchors.stellar.org renders client-side and returned no list; xramps.moneygram.com and stellar.moneygram.com returned 403). Where a claim comes only from third-party or automated sources, it is labelled. Items marked "[unverified, from background knowledge]" were not confirmed this session and should be checked before anyone relies on them.

## 1. Which anchors and ramps are live in 2026, and what do they cover?

### Takeaway
The credible production paths for a real business converting fiat profits into USDC on Stellar are: (1) **Circle Mint**, Circle's direct business account (KYB, USD wire in, USDC on Stellar out, and the reverse); (2) **MoneyGram Ramps**, for retail cash-in/cash-out of USDC (cash-out in 170+ countries, which suits investors cashing out); and (3) regional anchors such as **Bitso** (LatAm), **Anclap** (ARS), **BlindPay** (multi-country LatAm/US API), and others from the SDF Anchor Directory. Several smaller anchors (Mykobo, Bitnovo, Clpx, Cowrie) appear delisted, degraded or out of scope (non-USDC) as of September-October 2026.

### Cited Findings
**Circle (USDC issuer)**
- Mainnet USDC on Stellar is `USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` and testnet USDC is `USDC-GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`. That page lists no Soroban contract IDs and no EURC on Stellar. — [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- Circle describes USDC on Stellar as a native asset that Circle issues. Transfers are standard payment operations submitted through Horizon, and a receiving account must first add a USDC trustline. — [Circle quickstart: transfer USDC on Stellar](https://developers.circle.com/stablecoins/quickstart-transfer-usdc-stellar); [Circle trustline quickstart](https://developers.circle.com/stablecoins/quickstart-setup-usdc-trustline-stellar)
- **Circle Mint:** businesses apply with business information (KYB approval process), deposit by wire after approval, can send USDC on Stellar on-chain, swap across chains in the account or via API, and "settle back into fiat via wire transfer". The account is described as free. The page cites data "as of June 2023", so it may be dated. — [Circle: USDC on Stellar](https://www.circle.com/multi-chain-usdc/stellar)
- An older Circle announcement (about 2021) says Circle Account and API services support converting bank funds into USDC on Stellar and back, across its Payments, Payouts and Accounts APIs. — [Circle blog](https://www.circle.com/blog/circle-account-and-api-services-now-support-usdc-on-stellar)
- **CCTP on Stellar:** Stellar is a supported CCTP chain with **domain ID 27**. It supports Standard Transfer as a source, but not Fast Transfer, upfront fees or the Forwarding Service. It is a destination for all CCTP transfers. "On Stellar, USDC precision and address encoding differ from other CCTP-supported blockchains." Inbound transfers should use `CctpForwarder`. Testnet is implied, because every listed mainnet's testnet is supported. — [Circle CCTP supported blockchains](https://developers.circle.com/cctp/cctp-supported-blockchains)
- News reports date CCTP going live on Stellar to **May 19, 2026**, linking 23 chains. — [BanklessTimes 2026-05-20](https://www.banklesstimes.com/articles/2026/05/20/circle-deploys-cctp-on-stellar-to-power-seamless-native-usdc-transfers/); [ETHNews](https://ethnews.com/circles-cctp-goes-live-on-stellar-linking-23-chains/). Conflict: a Coinspeaker/Yahoo article describes a CCTP V2 announcement for Stellar around September 2025, which was probably the announcement, not the launch. — [Yahoo Finance](https://finance.yahoo.com/news/circle-launch-cross-chain-transfer-162553894.html)

**MoneyGram Ramps**
- MoneyGram's developer portal says partners (wallets and exchanges) can integrate Ramps on **Solana or Stellar** for USDC cash-in and cash-out at MoneyGram locations worldwide. Onboarding is through a Partner Portal with a request for sandbox access. — [MoneyGram Developer Portal](https://developer.moneygram.com/moneygram-developer/docs/integrate-moneygram-ramps)
- The Stellar integration is built on SEP-24. Legacy Stellar partners use SEP-10 plus SEP-24, and there is a widget SDK with sandbox API keys (per the search snippet; the page itself returned 403). — [MoneyGram Ramps Developers](https://xramps.moneygram.com/ops/developer); SDF tool page: [developers.stellar.org/docs/tools/ramps/moneygram](https://developers.stellar.org/docs/tools/ramps/moneygram)
- Third-party coverage: cash-out in 170+ countries and territories, cash-in in about 25+. US access excludes Alaska, Hawaii, Louisiana and New York. Ramps has gone live on Solana, ending Stellar exclusivity. — [CryptoGames](https://cryptogames.gg/moneygram-ramps-goes-live-on-solana-ending-stellar-exclusivity/) (secondary; partly self-contradictory)
- Unverified claim that a MoneyGram stablecoin "MGUSD" launched natively on Stellar on 2026-06-02. — [eco.com](https://eco.com/support/en/articles/15346509-moneygram-api-integration-options-for-fintechs)

**Regional anchors (from the SDF directory and third-party monitoring)**
- The SDF Anchor Directory lists USDC anchors including **BlindPay** (Argentina, Brazil, Colombia, Mexico, US), **ChipperCash** (Ghana, Nigeria, Rwanda, Uganda, US, Zambia), **Coinme** (US), **Cebuana** (Philippines), **Anclap**, **Bitso** and **Circle**. — [Stellar Anchor Directory](https://anchors.stellar.org/) (from the search snippet; a live fetch returned no rendered list)
- BlindPay offers one REST API across EVM chains, Stellar and Solana for USDC/USDT, with a "Send" off-ramp from a wallet to a fiat bank account. No SEP compliance is documented. — [BlindPay docs](https://blindpay.com/docs/stablecoin/)
- Automated health checks (third-party "stellar-intel" project, October 20-25, 2026): **Mykobo** delisted 2026-09-06; **Cowrie** is NGNT, SEP-6/SEP-10 only; **Clpx** is the CLPX asset with its SEP-6/24 withdraw paths disabled; **Bitnovo** returning HTTP 502 for more than a week with an unverifiable USDC issuer; **Anclap** (ARS) passing. — [stellar-intel #1427](https://github.com/ezedike-evan/stellar-intel/issues/1427); [#1522](https://github.com/ezedike-evan/stellar-intel/issues/1522); [#2015](https://github.com/ezedike-evan/stellar-intel/issues/2015) (non-authoritative)
- Same project: FinClusive (USDC to USD, SEP-24 deposit and withdraw, census 2026-09-23) and APS Ramp (SEP-24 USDC) were onboarded but marked unverified. — [#1302](https://github.com/ezedike-evan/stellar-intel/issues/1302); [PR #1693](https://github.com/ezedike-evan/stellar-intel/pull/1693)

### Inferences
- For the "company deposits profits" leg, **Circle Mint** is the most credible production rail for US/global businesses: KYB, USD wire, native Stellar USDC, no anchor middleman. A SEP-24 consumer anchor is the wrong tool for a company moving large sums.
- For the "investor cashes out" leg, **MoneyGram Ramps** (cash, broad coverage) plus a bank-payout anchor (Bitso, BlindPay or Anclap in LatAm; Circle Mint for US institutional investors) is the realistic mix.
- CCTP lets a company that already holds USDC on Ethereum, Base or Solana move it to Stellar without an anchor, which is useful for businesses whose treasury is on another chain.

### Gaps
- Not verified this session: Vibrant, Coins.ph, Settle Network, Alfred, Beans, Arf, Tempo, and whether Bitstamp or Kraken offer direct USDC-on-Stellar withdrawals. I found no sources on them (search returned nothing on Vibrant). [Background knowledge, unverified: Vibrant was an SDF-built consumer wallet app, and Beans is a wallet, not an anchor; both should be treated as wallets, not ramps.]
- No fee schedules or limits found for Circle Mint, MoneyGram Ramps (MoneyGram sets fees per corridor and shows them in the SEP-24 flow), Bitso or BlindPay.
- The live anchor directory could not be scraped. Check https://anchors.stellar.org (filter by asset USDC and by SEP) and each anchor's `/.well-known/stellar.toml` directly.
- Bitso's Stellar anchor documentation (docs.bitso.com, an "mm-xb" cross-border section) was found but the fetched page was the generic Trading API overview, so Bitso's SEP-31 corridors and KYB process remain unconfirmed.

## 2. Which SEP standards matter, and which suit B2B versus consumer flows?

### Takeaway
SEP-1 (stellar.toml discovery), SEP-10 (wallet authentication), SEP-12 (KYC/KYB data), SEP-38 (quotes) are building blocks. SEP-24 is the hosted, interactive webview flow where the anchor handles KYC (consumer). SEP-6 is the programmatic version with no webview, which suits a backend or business. SEP-31 is anchor-to-anchor cross-border payment (B2B remittance). For a dividend platform: SEP-24 for investor cash-out in a demo, SEP-6 or Circle's API for the company treasury in production, SEP-31 only if the platform becomes a sending anchor for cross-border payouts.

### Cited Findings
- SEP-24 is the hosted flow where "the user's application must open a webview hosted by a third-party anchor" and the anchor handles KYC. SEP-31 is the cross-border payments API, and SEP-10 handles authentication. — [Stellar docs: Anchors](https://developers.stellar.org/docs/learn/fundamentals/anchors)
- SDF lists SEP-6, SEP-24 and SEP-31 as the most important SEPs for anchors, with SEP-38 for quotes. — [Stellar docs: Anchors](https://developers.stellar.org/docs/learn/fundamentals/anchors)
- The Anchor Platform lists SEP-31 as "cross-border payment processing (receive only)". — [Anchor Platform docs](https://developers.stellar.org/docs/platforms/anchor-platform); [AP SEP-31 config](https://developers.stellar.org/docs/platforms/anchor-platform/sep-guide/sep31/configuration)
- SEP-31 specifies how anchors interact with one another to build a rail between two regions (Bitso's description). — via search snippet of [Bitso docs](https://docs.bitso.com/mm-xb/docs/anchor-interaction)
- The SDF reference test anchor implements SEP-6, 10, 12, 24, 31 and 38 (see section 3 for its endpoints). — [testanchor stellar.toml](https://testanchor.stellar.org/.well-known/stellar.toml)
- MoneyGram uses SEP-10 plus SEP-24. — [MoneyGram Ramps Developers](https://xramps.moneygram.com/ops/developer)

### Inferences
- A company deposit is better served by SEP-6 (API, no webview) or SEP-31 with a business sender profile, but few USDC anchors expose SEP-6 deposit for businesses. Circle Mint's proprietary API is the practical choice.
- Investor withdrawal: SEP-24 gives the fastest integration, because the anchor hosts KYC and the bank form.

### Gaps
- A per-anchor SEP support matrix for the production USDC anchors (Bitso, BlindPay, Anclap, ChipperCash, Coinme, Cebuana) couldn't be confirmed, because the directory couldn't be scraped. It needs a live `/info` and stellar.toml check per anchor.

## 3. Testnet availability and the fastest integration path

### Takeaway
Use **testanchor.stellar.org**, SDF's reference anchor on testnet, which supports SEP-6/10/12/24/31/38 and *testnet USDC from Circle's issuer*, together with **@stellar/typescript-wallet-sdk**. It is possible to build a working SEP-10 to SEP-24 deposit/withdraw flow in an afternoon. MoneyGram also offers a sandbox, but it needs Partner Portal approval.

### Cited Findings
- testanchor stellar.toml (fetched 2026-10-25):
  - `NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"`
  - `WEB_AUTH_ENDPOINT = https://testanchor.stellar.org/auth` (SEP-10)
  - `TRANSFER_SERVER = https://testanchor.stellar.org/sep6`
  - `TRANSFER_SERVER_SEP0024 = https://testanchor.stellar.org/sep24`
  - `KYC_SERVER = https://testanchor.stellar.org/sep12`
  - `DIRECT_PAYMENT_SERVER = https://testanchor.stellar.org/sep31`
  - `ANCHOR_QUOTE_SERVER = https://testanchor.stellar.org/sep38`
  - `SIGNING_KEY = GCHLHDBOKG2JWMJQBTLSL5XG6NO7ESXI2TAQKZXCXWXB5WI2X6W233PR`
  - Currencies: `SRT` (issuer `GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B`), **`USDC` (issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`, which is Circle's testnet USDC)**, and native XLM. — [testanchor.stellar.org/.well-known/stellar.toml](https://testanchor.stellar.org/.well-known/stellar.toml)
- Wallet SDK is available in TypeScript, Kotlin, Flutter and Swift. — [Wallet SDK overview](https://developers.stellar.org/docs/build/apps/wallet/overview)
- The TypeScript package is `@stellar/typescript-wallet-sdk`. The SEP-24 flow is `anchor.getInfo()` to find the USDC currency, then `IssuedAssetId(code, issuer)`, then `const sep24 = await anchor.sep24()`, then `sep24.deposit({assetCode, authToken})` / `sep24.withdraw({assetCode, authToken})`. Each returns `{url, id}`, and the url opens in an iframe or popup. KYC can be pre-filled through `extraFields` (SEP-9 fields), and `destinationAccount` / `withdrawalAccount` can be overridden. A watcher follows progress: `sep24.watcher().watchOneTransaction({authToken, assetCode, id, onMessage, onSuccess, onError})`. On status `pending_user_transfer_start` for a withdrawal, the wallet builds `txBuilder.transferWithdrawalTransaction(transaction, asset).build()`, signs and submits it. On `tx_bad_seq`, rebuild; on HTTP 504, resubmit. — [Wallet SDK SEP-24 guide](https://developers.stellar.org/docs/build/apps/wallet/sep24); SEP-10 auth is covered in [sep10 guide](https://developers.stellar.org/docs/build/apps/wallet/sep10)
- MoneyGram sandbox: request sandbox access through the Partner Portal. Stellar partners get a widget SDK with sandbox API keys. — [MoneyGram Developer Portal](https://developer.moneygram.com/moneygram-developer/docs/integrate-moneygram-ramps)
- Anchor Platform: SDF's open-source server for running your own anchor (SEP-1/6/10/12/24/31/38), with SEP-31 receive-only. — [Anchor Platform](https://developers.stellar.org/docs/platforms/anchor-platform)

### Inferences
- Demo path for a hackathon: (a) fund testnet accounts with Friendbot XLM; (b) add a USDC trustline to `GBBD47…FLA5`; (c) get testnet USDC from faucet.circle.com (Stellar option); (d) "company deposits profits" can be shown as a SEP-24 or SEP-6 deposit from testanchor, or simply as a faucet top-up labelled "Circle Mint (simulated)"; (e) pro-rata distribution happens via your Soroban contract or batched payment ops; (f) an investor cash-out is a SEP-24 withdraw to testanchor in an iframe. Because testanchor issues no USDC of its own and lists Circle's testnet issuer, real testnet USDC round-trips through it in the demo.
- Stellar Demo Wallet (demo-wallet.stellar.org) can be used to show the anchor flow manually before coding. [Background knowledge, URL not re-verified this session.]
- Stellar Wallets Kit (`@creit.tech/stellar-wallets-kit`) handles Freighter, xBull, Albedo and similar wallet connections for SEP-10 signing in the browser. [Background knowledge, unverified this session.]

### Gaps
- MoneyGram's testnet domain and test asset (historically `extstellar.moneygram.com` with testnet USDC) could not be confirmed, because the MoneyGram pages returned 403. [Background knowledge, unverified.]
- Whether production anchors (Bitso, BlindPay and others) have public testnet sandboxes: not found.

## 4. Stellar Disbursement Platform (SDP): fit for pro-rata dividends?

### Takeaway
SDP is SDF's open-source bulk-payout system (backend, frontend and Helm chart). It is designed for disbursements to *people identified by phone or email*, who register a wallet via SEP-24 and verify with an OTP plus a field such as date of birth. It can pay from a Stellar distribution account or a **Circle** account. It works well for aid- or payroll-style payouts, but it is heavy for a hackathon: Docker, multiple services, and a wallet allowlist agreement. For token-holder dividends where wallet addresses are already known, a Soroban distribution contract or batched payments are simpler. SDP is worth citing as the production option for paying investors who lack wallets.

### Cited Findings
- SDP is open source across three repos (backend/infra, frontend, Helm chart for Kubernetes), with an Admin Guide and API Reference. — [SDP overview](https://developers.stellar.org/platforms/stellar-disbursement-platform)
- Local testnet quickstart: clone the repo, run `make setup`, choose testnet and single-tenant, generate accounts. Dashboard runs at localhost:3000, demo wallet at localhost:4000, SEP-24 home domain at localhost:8000. Requires Docker, Git and Go (jq optional). Explicitly "a learning environment rather than the path for production deployments". — [SDP Getting Started](https://developers.stellar.org/docs/platforms/stellar-disbursement-platform/admin-guide/getting-started)
- Flow: create a disbursement (contact type phone, asset, recipient wallet, verification method such as date of birth), upload a CSV, confirm (status Ready). The receiver registers via a SEP-24 deposit on the SDP's home domain, enters an OTP plus the verification field, and the payment goes Ready, then PENDING, then Success. — [SDP Getting Started](https://developers.stellar.org/docs/platforms/stellar-disbursement-platform/admin-guide/getting-started)
- Wallets must have an agreement with the SDP operator and allowlist the SDP domain. Registration uses a deep link tied to the SDP, organization and asset, and authentication uses the SDP's stellar.toml and SEP-10 key. — [Making your wallet SDP-ready](https://developers.stellar.org/docs/platforms/stellar-disbursement-platform/admin-guide/making-your-wallet-sdp-ready)
- Circle distribution accounts: the tenant owner enters a Circle API key (stored encrypted with `DISTRIBUTION_ACCOUNT_ENCRYPTION_PASSPHRASE`) and a Wallet ID in the dashboard. — [SDP Circle configuration](https://developers.stellar.org/docs/platforms/stellar-disbursement-platform/admin-guide/user-interface/circle-configuration)
- Registration (OTP via email or SMS that must match stored receiver contact) happens once per receiver. — [SDP API: registration](https://developers.stellar.org/docs/platforms/stellar-disbursement-platform/api-reference/registration)

### Inferences
- Amounts in SDP are per-row in the CSV, so pro-rata maths must be done upstream (snapshot holders, compute shares, generate the CSV). SDP doesn't compute pro-rata itself.
- The SDP plus Circle distribution account combination is a strong production story: a company's Circle Mint balance funds payouts directly.

### Gaps
- Whether recent SDP versions support a "known wallet address" receiver type (paying a G- or C-address directly without SEP-24 registration) wasn't confirmed in the docs fetched. Check the SDP GitHub releases (github.com/stellar/stellar-disbursement-platform-backend).
- No SDF-hosted public SDP instance was found for testnet.

## 5. Testnet and mainnet USDC: issuer and how to obtain

### Takeaway
Testnet USDC issuer: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`. Mainnet: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`. Get testnet USDC from faucet.circle.com (select Stellar) after adding a trustline, and get XLM for fees from Friendbot.

### Cited Findings
- Issuers as above. — [Circle USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- Faucet: faucet.circle.com, select "Stellar", paste the testnet address, click "Get Tokens". Fund XLM via Friendbot. — [Trustless Work testnet tokens guide](https://docs.trustlesswork.com/tools-and-utilities/testnet-tokens); [Circle quickstart](https://developers.circle.com/stablecoins/quickstart-transfer-usdc-stellar)
- testanchor.stellar.org lists the same testnet USDC issuer. — [testanchor stellar.toml](https://testanchor.stellar.org/.well-known/stellar.toml)

### Inferences
- For Soroban contracts, use the Stellar Asset Contract (SAC) address of USDC. It can be derived deterministically, for example with `stellar contract id asset --asset USDC:GBBD47…FLA5 --network testnet`. [Background knowledge; Circle's page doesn't list the C-address.]

### Gaps
- The Circle faucet's per-request amount and rate limit were not verified.

## 6. KYB support, and reusing SEP-12 KYC data for investor checks

### Takeaway
SEP-9, the field dictionary used by SEP-12, defines **organization.* KYB fields** (name, registration number, VAT, registered address, shareholders, director, incorporation document). Anchors that implement SEP-12 for businesses can collect KYB through it. For individuals, SEP-9 has no explicit "nationality" field, only `address_country_code`, `birth_country_code`, `id_country_code` (the country that issued the ID) and `birth_place`. SEP-12 data is held by the anchor, and an anchor generally exposes only verification *status* (ACCEPTED, NEEDS_INFO and so on) back to the wallet, not the underlying PII. So the platform can't treat an anchor's KYC as its own investor-accreditation or nationality check without a separate data-sharing agreement.

### Cited Findings
- SEP-9 (status Active, v1.17.0 or v1.18.0 per the changelog) organization fields: `organization.name`, `.VAT_number`, `.registration_number`, `.registration_date`, `.registered_address`, `.number_of_shareholders`, `.shareholder_name`, `.photo_incorporation_doc`, `.photo_proof_address`, `.address_country_code`, `.state_or_province`, `.city`, `.postal_code`, `.director_name`, `.website`, `.email`, `.phone`. — [SEP-9 spec](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0009.md)
- Person fields relevant to jurisdiction: `address_country_code` (residence), `birth_country_code`, `id_country_code` (ISO 3166-1 alpha-3 issuer of the passport or ID), `birth_place`. No explicit nationality or citizenship field. — [SEP-9 spec](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0009.md)
- Circle Mint onboarding is KYB-gated (business information, then approval). — [Circle: USDC on Stellar](https://www.circle.com/multi-chain-usdc/stellar)
- The wallet SDK lets a wallet pre-fill SEP-24 KYC with SEP-9 fields through `extraFields`. — [Wallet SDK SEP-24](https://developers.stellar.org/docs/build/apps/wallet/sep24)

### Inferences
- Recommended design: the platform runs its own investor KYC (or uses a KYC vendor) and stores a nationality or eligibility flag on-chain or in a compliance contract (an allowlist). It pre-fills anchors via `extraFields` / SEP-12 PUT so investors don't re-enter data. The flow is reuse *outward* (platform to anchor), not inward.
- For the hackathon, `id_country_code` or `address_country_code` collected in the platform's own SEP-12-style form can drive a jurisdiction gate (for example, blocking US non-accredited investors).
- Running your own Anchor Platform instance gives a SEP-12 KYC server whose data the platform *does* own. This is one way to make "SEP-12 reuse" real.

### Gaps
- Which production USDC anchors accept business customers through SEP-12 organization fields: not confirmed for Bitso, BlindPay, MoneyGram (retail only, per its consumer cash model) or Anclap.

## 7. Recommendation

### Takeaway
**Production:** (1) **Circle Mint**, the company treasury on-ramp and off-ramp (KYB, USD wire to native Stellar USDC, also usable as an SDP distribution account; CCTP domain 27 brings in USDC from other chains); (2) **MoneyGram Ramps**, the investor cash-out to cash in 170+ countries via SEP-24 (partner onboarding needed); (3) a regional bank-payout anchor, **Bitso** or **BlindPay** (LatAm/US bank rails) or **Anclap** (Argentina), picked from the live directory for the target investor geography. **Hackathon demo:** testanchor.stellar.org plus @stellar/typescript-wallet-sdk, with Circle testnet USDC (`GBBD47…FLA5`) from faucet.circle.com. Show company deposit as SEP-24/SEP-6 deposit or a simulated Circle Mint top-up, distribute via a Soroban contract, and show investor withdrawal as a SEP-24 withdraw. Mention SDP plus Circle as the production scaling path for investors without wallets.

### Cited Findings
- Circle Mint capabilities — [Circle: USDC on Stellar](https://www.circle.com/multi-chain-usdc/stellar); CCTP domain 27 — [Circle CCTP](https://developers.circle.com/cctp/cctp-supported-blockchains)
- MoneyGram Ramps on Stellar via SEP-24, sandbox through the Partner Portal — [MoneyGram Developer Portal](https://developer.moneygram.com/moneygram-developer/docs/integrate-moneygram-ramps); coverage — [CryptoGames](https://cryptogames.gg/moneygram-ramps-goes-live-on-solana-ending-stellar-exclusivity/)
- Regional USDC anchors in the directory — [Stellar Anchor Directory](https://anchors.stellar.org/); BlindPay API — [BlindPay docs](https://blindpay.com/docs/stablecoin/)
- testanchor endpoints and USDC — [testanchor stellar.toml](https://testanchor.stellar.org/.well-known/stellar.toml); SDK — [Wallet SDK SEP-24](https://developers.stellar.org/docs/build/apps/wallet/sep24)
- SDP plus Circle — [SDP Circle configuration](https://developers.stellar.org/docs/platforms/stellar-disbursement-platform/admin-guide/user-interface/circle-configuration)

### Inferences
- Don't pitch MoneyGram as a company on-ramp for large profit deposits. It is a retail cash network (cash-in in only about 25 countries), so it fits investor cash-out.
- Avoid depending on Mykobo, Bitnovo, Clpx or Cowrie, which were delisted, degraded or not USDC as of October 2026 per third-party monitoring.
- In the pitch, frame anchors as pluggable (any SEP-24/SEP-6 anchor found via SEP-1 discovery works), and show this by pointing the same code at testanchor now and MoneyGram or Bitso later.

### Gaps
- No fees or limits are confirmed for any recommended provider. Circle Mint eligibility by country (it is generally unavailable in some jurisdictions) was not checked.
