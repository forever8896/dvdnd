# Soroban smart-contract ecosystem for a bonding-curve launchpad with locking and USDC dividends (as of 2026-10-25)

Scope: reusable contracts and libraries, live AMMs to graduate into, existing launchpads, dividend and storage patterns, tooling and fees. Live network facts below marked "(live query 2026-10-25)" come from my own JSON-RPC and Horizon calls on that date. Sources dated before 2026 are marked as possibly outdated.

## 1. OpenZeppelin Stellar Contracts (stellar-contracts), 2026 state

### Takeaway
OpenZeppelin's `stellar-contracts` is the standard Soroban library. v0.8.0 shipped on 2026-10-20. It covers fungible tokens, an ERC-3643 RWA token with six T-REX-style compliance modules, an ERC-4626 vault, access control, upgradeability, a governance timelock, a Merkle distributor, smart accounts and fee abstraction. It has **no vesting or staking/lock module**, so time-locked staking and the dividend accumulator have to be custom-built.

### Cited Findings
**Repo, crates and versions**
- Repo: https://github.com/OpenZeppelin/stellar-contracts. Published crates: `stellar-access` (RBAC, Ownable), `stellar-accounts` (smart accounts), `stellar-confidential` (confidential token), `stellar-contract-utils` (pausable, upgradeable, cryptography, Merkle distributor), `stellar-fee-abstraction`, `stellar-governance` (governor, votes, timelock), `stellar-macros` (`#[only_owner]`, `#[when_not_paused]`, `#[only_role]`), `stellar-tokens` (fungible, NFT, RWA, vault). The README's pinned dependency example uses version 0.8.0. — [GitHub README](https://github.com/OpenZeppelin/stellar-contracts)
- Release history from the GitHub releases API:
  - v0.8.0 (2026-10-20): new Confidential Token crate, RWA compliance modules, vault changes, smart-account digest changes, fee-abstraction `Eager` changes. soroban-sdk bumped to 27.0.2, plus a "P28" (protocol 28) PR.
  - v0.7.3 (2026-10-20): security fix for smart-account delegated signers.
  - v0.8.0-rc.1 to rc.3 (June 2026): audit release candidates.
  - v0.7.2 (2026-06-09): soroban-sdk 26.1.0.
  - v0.7.1 (2026-04-10): governance timelock trait.
  - v0.7.0 (2026-04-03): Governance and Votes, ZkEmail DKIM registry, smart-accounts rework, RWA reorganization, Merkle distributor event change, soroban-sdk v25.
  - No release mentions vesting.
  - — [GitHub releases API](https://api.github.com/repos/OpenZeppelin/stellar-contracts/releases)
- Earlier releases (from a search snippet of the changelog): v0.5.0 (October 2025) added the ERC-3643 RWA token and the ERC-4626 vault. v0.6.0 (2026-01-26) added Timelock, WAD and power-function fixed-point maths, and a Fee Forwarder. — [OZ changelog (search snippet)](https://docs.openzeppelin.com/stellar-contracts/changelog)
- Docs navigation:
  - Accounts: Smart Account
  - Tokens: Fungible, NFT, RWA, Vault (ERC-4626), Confidential
  - Access Control: Ownable, RBAC
  - Governance: Governor, Votes, Timelock Controller
  - Utilities: Pausable, Upgradeable, WAD, Fixed-Point Math, Cryptography, Merkle Distributor
  - Fee Abstraction
  - Tools: UIKit, Relayer 1.5.x, Monitor 1.3.x, Role Manager, RWA Wizard
  - No vesting module is listed.
  - — [docs.openzeppelin.com/stellar-contracts](https://docs.openzeppelin.com/stellar-contracts)
- Audit status: Stellar's docs say "All contracts and extensions are audited by OpenZeppelin's security team" and that Certora is doing formal verification. Reports are in the repo's `audits/` directory. — [developers.stellar.org OZ page](https://developers.stellar.org/docs/tools/openzeppelin-contracts)
- Immunefi bug bounty "OpenZeppelin on Stellar" covers the latest release (page updated 2026-04-21). — [Immunefi](https://immunefi.com/bug-bounty/openzeppelin-stellar/scope/)
- Fungible token extensions: Burnable, Capped, Allowlist, Blocklist. A Stablecoin variant uses the same set. The Vault implements SEP-56. The Confidential token says "Proofs are not yet zero-knowledge". Smart accounts ship context rules, signers, policies (multisig, spending limits) and verifiers. — [developers.stellar.org OZ page](https://developers.stellar.org/docs/tools/openzeppelin-contracts)
- Contract Wizard: https://wizard.openzeppelin.com/stellar. RWA Wizard generates ERC-3643 (T-REX) contracts on the library. — [OZ RWA Wizard news](https://openzeppelin.com/news/rwa-wizard-issue-regulated-real-world-assets-on-stellar)

**RWA token (ERC-3643)**
- Location and composition: `packages/tokens/src/rwa`, imported as `stellar_tokens::rwa::{RWAToken, RWA}`. `RWAToken` builds on `FungibleToken + FungibleTotalSupply + Pausable`.
- Separate contracts the token depends on:
  - Identity Verifier: `verify_identity`, `recovery_target`.
  - Compliance contract, which can be shared across tokens: `transferred`, `created`, `destroyed` hooks.
- Suggested claim-based identity stack: Identity Registry Storage (wallet to identity, country, recovery), Identity Claims, Claim Topics & Issuers, and a Claim Issuer that accepts Ed25519, secp256k1 and secp256r1 signatures and supports revocation and expiry.
- Built-in compliance modules: `country_allow`, `country_restrict`, `transfer_allow`, `time_transfers_limits`, `max_balance`, `supply_limit`, `initial_lockup_period`.
- Other features: address-level and partial freezing, `recover_balance`, forced transfers (bypass freezes and work while paused), `DocumentManager` (ERC-1643), `TokenBinder` (max 75 tokens per periphery contract), and `batch_*` operations.
- Transfer flow: verify sender identity, then recipient identity, then freeze checks and balance update, then the compliance `transferred` hook (a panic there reverts the transfer).
- `RWA` functions do no auth themselves. Each contract must enforce auth on the `operator` argument.
- — [OZ RWA docs](https://docs.openzeppelin.com/stellar-contracts/tokens/rwa/rwa)

**Vault (ERC-4626)**
- `stellar_tokens::vault`, implemented as `FungibleVault` with `Compose<(Vault, TotalSupply)>`.
- Rounding: deposit and redeem round down; mint and withdraw round up.
- The decimals offset (max 10) adds virtual shares. A zero-share deposit reverts with `VaultZeroShares`. With offset 0, inflation attacks are still possible, so use a larger offset or dead shares.
- The asset and offset are immutable after the constructor.
- — [OZ Vault docs](https://docs.openzeppelin.com/stellar-contracts/tokens/vault/vault)

**Merkle Distributor**
- `stellar_contract_utils::merkle_distributor`.
- API: `MerkleDistributor<H>` with `set_root` (no auth, so call it from the constructor or an admin function), `get_root`, `is_claimed`, `verify_and_set_claimed` (sorted-pair tree), and `verify_with_index_and_set_claimed`.
- Leaves implement `IndexableLeaf` (u32 index) and are hashed over XDR. The example uses `Keccak256`.
- Claim flags are stored per index in persistent storage.
- The root can be updated for append-only distributions.
- — [OZ Merkle Distributor docs](https://docs.openzeppelin.com/stellar-contracts/utils/crypto/merkle-distributor)

### Inferences
- For (e): use `stellar-tokens` RWA plus the `initial_lockup_period`, `max_balance` and `country_*` modules. The launchpad, bonding-curve and staking contracts must themselves be registered or allowlisted identities, or the transfer hooks will block curve buys and staking deposits.
- For (c): no audited OZ vesting or staking module exists. Build a custom lock contract and reuse OZ `access`, `pausable`, `upgradeable` and WAD maths. An ERC-4626 vault does not natively express time locks.
- For (d): the Merkle distributor fits per-period snapshot payouts computed off-chain, one root per dividend period.
- SDK versions: v0.8.0 targets soroban-sdk 27.x, while the newest stable soroban-sdk is 29.0.1 (see section 5). Pin a soroban-sdk version compatible with the OZ release rather than the latest.

### Gaps
- No audit report names or dates were retrieved from `audits/`. Whether v0.8.0's RWA compliance modules and confidential token have completed audit is unconfirmed (rc builds were labelled "audit release candidates").
- Exact crates.io versions for each `stellar-*` crate were not individually checked.

## 2. Soroban AMMs and DEXes as graduation targets

### Takeaway
Graduation candidates:
- **Soroswap:** UniswapV2 clone. `add_liquidity` auto-creates the pair, and the only verified pump.fun-style launchpad on Stellar (Hooks) already graduates into it.
- **Aquarius:** the largest AMM by TVL, with constant-product, stableswap and concentrated pools and AQUA LP rewards.
- **Comet:** Blend's Balancer-style pool, exploited in August 2026. Avoid it.
- **Phoenix:** 2026 status is unclear.

### Cited Findings
**Soroswap**
- Design: "a Rust implementation of the UniswapV2 design on Soroban". Core audited by OtterSec. Source: github.com/soroswap/core. — [Soroswap AMM docs](https://docs.soroswap.finance/amm.md)
- Mainnet addresses: factory `CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2`, router `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH`. — [soroswap/core mainnet.contracts.json](https://raw.githubusercontent.com/soroswap/core/main/public/mainnet.contracts.json)
- Router functions:
  - `add_liquidity(token_a, token_b, amount_a_desired, amount_b_desired, amount_a_min, amount_b_min, to, deadline) -> (i128,i128,i128)`
  - `remove_liquidity(...)`
  - `swap_exact_tokens_for_tokens(amount_in, amount_out_min, path, to, deadline)`
  - `swap_tokens_for_exact_tokens(...)`
  - read-only: `router_pair_for`, `router_get_amounts_out`, `router_quote`
  - `add_liquidity` creates the pair if it doesn't exist. All state-changing functions call `to.require_auth()` and enforce `deadline`.
  - — [soroswap/core router lib.rs](https://raw.githubusercontent.com/soroswap/core/main/contracts/router/src/lib.rs)
- Odd doc comment: the fetch tool flagged a doc comment on `get_factory` in router `lib.rs` that links to `github.com/benjaminsalon/malicious_sorochat`. It looks like a leftover comment with no logic impact, but review it. — [router lib.rs](https://raw.githubusercontent.com/soroswap/core/main/contracts/router/src/lib.rs)
- Aggregator and API:
  - Aggregator repo with Soroswap and Phoenix adapters: github.com/soroswap/aggregator. — [GitHub](https://github.com/soroswap/aggregator)
  - Soroswap API at `https://api.soroswap.finance?network=` returns routes you can "execute from your own Soroban contract", with optional partner fees settled monthly in USDC. — [Soroswap docs](https://docs.soroswap.finance/)
- TVL: about $1.18M on 2026-10-23, down 5.2% over 30 days. Swap-fee revenue fell from $44.41K (Q3 2025) to $9.47K (Q2 2026). — [DefiLlama Soroswap via search](https://defillama.com/protocol/soroswap)

**Aquarius**
- Router addresses: mainnet `CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK`; testnet `CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD` (updated Feb 2026). SDKs: `@stellar/stellar-sdk` v15+ and Python `stellar-sdk`. — [Aquarius docs: prerequisites](https://docs.aqua.network/developers/code-examples/prerequisites-and-basics.md)
- Router `deposit(user, tokens, pool_index, desired_amounts, min_shares)`.
  - Example volatile pools charge 10 and 30 bps.
  - `pools_for_pair` lists pools by type and fee.
  - `deposit` refuses concentrated pools; manage those through the pool contract.
  - Further reference: https://docs.aqua.network/developers/reference/router-and-pool-contracts.md
  - — [Aquarius docs: deposit liquidity](https://docs.aqua.network/developers/code-examples/deposit-liquidity.md)
- Code-generated wiki of AquaToken/soroban-amm: `LiquidityPoolRouter` with `init_standard_pool()` / `init_stableswap_pool()`; pools expose `deposit/swap/withdraw/claim`; LP share token is SEP-41. Auto-generated, so verify against the code. — [DeepWiki soroban-amm](https://deepwiki.com/AquaToken/soroban-amm/)
- TVL about $39M (DefiLlama Stellar chain page, undated snapshot). — [DefiLlama Stellar](https://defillama.com/chain/stellar)

**Blend / Comet**
- TVL: Blend about $165M (DefiLlama, undated snapshot). — [DefiLlama Stellar](https://defillama.com/chain/stellar)
- August 2026 exploit: a "vulnerability in same-asset USDC swaps" in the Comet AMM BLND-USDC pool (Blend's backstop) lost about $717K. Blend paused the backstop. Stellar TVL fell from about $270M (2026-08-22) to about $98M (2026-08-27), and Blend TVL went from over $150M to nearly zero, mostly from withdrawals. These are secondary press reports; no official post-mortem was found. — [CoinTurk](https://en.coin-turk.com/stellar-defi-tvl-plunges-60yuzde-after-717k-blend-exploit-xlm-holds-0-18/); [edgeX/DailyCoin](https://pro.edgex.exchange/en-US/news/article/stellar-tvl-falls-after-blend-exploit)
- February 2026 YieldBlox incident on Blend V2 (over $10M): oracle misconfiguration and thin liquidity, not a core-contract bug. — [BlockSec](https://blocksec.com/blog/yieldblox-dao-incident-on-stellar-oracle-misconfiguration-enabled-a-10m-drain); [Rekt](https://rekt.news/yieldblox-rekt)
- Blend v2 had a Code4rena audit with Certora formal verification (Feb 2025). — [Code4rena](https://code4rena.com/audits/2025-02-blend-v2-audit-certora-formal-verification)
- Stellar DeFi TVL hit a record $272M on 2026-10-05, with $934.5M in stablecoins and $2.82B in RWAs. This conflicts with the roughly $270M August peak above. — [Tron Weekly](https://www.tronweekly.com/stellar-defi-tvl-hits-272m-ath-driven-by-rwa-and-usdc/)

**Phoenix**
- Contracts: Pool, StablePool, Staking, Multihop, Factory. The Factory can deploy and deregister pools. Audited by Veridise. Launch-era (2023–24) material; no 2026 status found. — [SCF submission](https://communityfund.stellar.org/submissions/recyJLOWkdnsGtimI); [SCF submission](https://communityfund.stellar.org/submissions/recW43Bu8M9c0Mb0p)

**Stellar reference pool**
- SDF example liquidity pool: Soroban pools cannot interact with Stellar's built-in (classic) AMM pools. — [Stellar docs liquidity-pool example](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/liquidity-pool)

### Inferences
- Graduating from a contract: on Soroswap, the launchpad contract calls `router.add_liquidity(token, USDC, ..., to = self, deadline)`. The contract authorizes its own token transfers as the current contract address. Keep or burn the LP tokens; Hooks keeps them in the launchpad forever.
- Pre-seeded pools: a griefer can create the pair early at a bad price. Hooks handles this by swapping the pool back to the curve price before depositing (section 3). Copy that logic.
- Aquarius has much deeper liquidity and LP rewards, but each pool type has its own pool contract and router index. For compliance-gated (RWA) tokens, any AMM pool contract must be an allowlisted identity, which conflicts with permissionless trading. Graduation into a public AMM may be incompatible with strict ERC-3643 transfer rules unless the pool address is whitelisted and buyers are still KYC-checked at the token level.
- Avoid Comet as a graduation target after the August 2026 exploit.

### Gaps
- Soroswap testnet addresses (in `public/testnet.contracts.json`) were not fetched, and testnet resets change them.
- No Comet or Blend contract addresses, Phoenix 2026 deployment status, Phoenix addresses, or Aquarius pool-creation fee were retrieved.
- Aquarius's soroban-amm GitHub repo returned 404 at github.com/AquaToken/soroban-amm (it may have moved or gone private).

## 3. Existing bonding-curve launchpads on Stellar/Soroban

### Takeaway
No major pump.fun-scale launchpad exists on Stellar as of October 2026; 2026 roundups of memecoin launchpads list none. The closest and most relevant open-source reference is **Hooks** (adrianvrj/hooks). It is MIT-licensed, unaudited and testnet-only, and combines a virtual-reserve constant-product curve, Soroswap graduation and a per-token dividend accumulator, which is almost exactly this project's design.

### Cited Findings
**Hooks** — [GitHub adrianvrj/hooks](https://github.com/adrianvrj/hooks)
- Bonding curve: constant product with virtual reserves (pump.fun model). The reserve asset is an Etherfuse stablebond (CETES/Tesouro) rather than XLM, so the reserve earns yield. `START_USD` defaults to $300, and graduation happens at about 2.93 times that.
- Supply: fixed 1B tokens, all minted to the launchpad in the constructor, with no mint entrypoint. 800M are sold on the curve; 200M plus the reserve seed a Soroswap pool at graduation.
- Fees: 1% per buy and sell, split 0.5% creator, 0.25% meme vault, 0.25% protocol. `DIV_BPS` (default 5000) of the vault inflows goes to holder dividends; the rest buys back and burns.
- Buyback is permissionless and capped at 1% of the pool reserve per call, which the author says makes sandwiching unprofitable given Soroswap's 0.3% fee.
- Dividends: the token's `notify` distributes using an accumulated-per-share counter (`dividend.rs`), and holders `claim`.
- Graduation (`migrate`) is permissionless after 800M are sold. It opens a Soroswap pool at the final curve price and keeps the LP tokens in the launchpad. If the pool was pre-seeded, it first swaps it back to the curve price; leftover tokens are burned and leftover reserve goes to the vault.
- Launchpad contract API: `create`, `buy`, `sell`, `migrate`, `buyback`, `claim_fees`, `claim_protocol`, `add_pair`, `upgrade`.
- `meme-token`: OpenZeppelin SEP-41 token plus burn plus dividends.
- 38 tests, run against the real Soroban factory and pair.
- Front end: Next.js with Mercury for trade history and Cavos/Freighter wallets.
- Deployment: testnet launchpad `CA3W7XW7TREX77B5EN3ZQOEZUBJ2M4FELRKQA42RCFPVMDYJ56SQ453W`; not on mainnet; unaudited; admin can upgrade.

**Other projects**
- Luukogood/stellar-token-launchpad: Soroban meme launchpad with bonding curves, fair launches and liquidity bootstrapping, plus a React/Node app. Seen only in a GitHub topic listing; not verified. — [GitHub topics](https://github.com/topics/launchpad?l=rust&o=asc&s=updated)
- soropad/launchpad: open-source SEP-41 token deployer for founders and DAOs, with per-wallet cliff and linear vesting. Not a bonding curve, but a possible vesting code reference. Fork: Abdulrasaq1515/launchpad. — [soropad/launchpad](https://github.com/soropad/launchpad); [fork](https://github.com/Abdulrasaq1515/launchpad)
- Proposal-stage issues only:
  - StellarDevHub Web3-Student-Lab #1634: polynomial bonding curve against XLM with slippage limits. — [issue](https://github.com/StellarDevHub/Web3-Student-Lab/issues/1634)
  - Fidelis900/soroban-starter-kit #1090: AMM graduation. — [issue](https://github.com/Fidelis900/soroban-starter-kit/issues/1090)
  - Fidelis900/soroban-starter-kit #1306: sigmoid curve. — [issue](https://github.com/Fidelis900/soroban-starter-kit/issues/1306)
  - Fidelis900/soroban-starter-kit #1307: holding-duration sell fee. — [issue](https://github.com/Fidelis900/soroban-starter-kit/issues/1307)
- 2026 memecoin-launchpad roundups list Pump.fun, BONK.fun, Bags, Zora and others, none on Stellar. — [Coin Bureau](https://coinbureau.com/analysis/best-memecoin-launchpads)

### Inferences
- Hooks is the best starting point. Fork or adapt its launchpad, graduation and anti-griefing logic and its `dividend.rs` accumulator, swapping the stablebond reserve for USDC. It needs an audit and a multisig admin before mainnet.
- A bonding-curve launchpad for compliance-gated private-equity tokens would be novel on Stellar (no competitor found), with regulatory review needed, as the Hooks author also notes.

### Gaps
- No SCF-funded bonding-curve launchpad was confirmed. SCF listings were not exhaustively searched.
- Hooks' soroban-sdk version and the exact curve formulas were not shown on the README.

## 4. Dividend distribution patterns and resource constraints

### Takeaway
Use a "reward per token" accumulator (Synthetix/MasterChef-style, as Hooks does). It costs O(1) per deposit, claim or notify regardless of holder count, which matters because Soroban limits each transaction's instructions and ledger-entry footprint, and storage pays rent with TTL expiry. Merkle claims (OZ Merkle Distributor) are the main alternative for off-chain snapshots. Iterating over all holders on-chain is not viable.

### Cited Findings
- Hooks implements dividends with an accumulated-per-share counter: `notify` adds to the counter, and holders `claim`. — [adrianvrj/hooks](https://github.com/adrianvrj/hooks)
- OZ Merkle Distributor: per-index claim flags in persistent storage (checking one extends its TTL); the root can be updated. — [OZ docs](https://docs.openzeppelin.com/stellar-contracts/utils/crypto/merkle-distributor)
- Storage types:
  - Temporary: cheapest; deleted at TTL 0 and cannot be restored.
  - Persistent: per-entry TTL; archived at TTL 0 and restorable. Archived persistent entries cannot be re-created, only restored.
  - Instance: same price as persistent; limited size; shares one TTL with the contract instance.
  - — [Stellar state archival](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival)
- TTL extension and restoration:
  - `extend_ttl(N)` sets the TTL to at least N ledgers, or does nothing if it is already higher. `ExtendFootprintTTLOp` extends from outside the contract. The max TTL is a network parameter (`max_ttl()`). A restored persistent entry gets at least `current_ledger + 4095`.
  - Protocol 23 (CAP-66) added automatic restoration of archived entries listed in the transaction's restore footprint, normally filled in by simulation.
  - — [Stellar state archival](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival)
- Per-transaction limits:
  - The resource fee covers CPU instructions, ledger entry accesses, read and write bytes, transaction size, events and return value, and rent. Rent, events and return value are refundable.
  - Memory is capped but not charged.
  - Smart-contract transactions are limited to one operation unless fee-bumped.
  - Exact numeric limits are network parameters, shown at lab.stellar.org/network-limits or via `stellar network settings`.
  - — [Stellar fees & metering](https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering); [Resource limits page](https://developers.stellar.org/docs/reference/resource-limits-fees)
- RWA batch operations are limited by Stellar network limits, not by the library. — [OZ RWA docs](https://docs.openzeppelin.com/stellar-contracts/tokens/rwa/rwa)

### Inferences
- Recommended design for (c) and (d):
  - A lock contract stores each holder's `Position {amount, unlock_ledger/time, reward_debt}` in persistent storage, with global `acc_usdc_per_share` (WAD-scaled, using OZ WAD) and `total_locked` in instance storage.
  - A `distribute(usdc_amount)` call by the company or treasury transfers USDC in and adds `amount * 1e18 / total_locked` to the accumulator.
  - `claim` pays `amount * acc - reward_debt`.
  - Per-period locks: either key positions by (holder, period_id), or keep one accumulator per epoch so that only tokens locked for the whole period earn.
- Per-period snapshot alternative: compute balances off-chain from contract events via an indexer, post a Merkle root per period to an OZ Merkle Distributor holding the USDC, and let users claim. This is cheaper on-chain and flexible, but trust-dependent.
- Rent: extend user position TTLs on every interaction. Because Protocol 23 auto-restores archived entries, long-dormant lockers' positions are not lost, but the restore costs fees. Never put per-user data in temporary storage.
- Compliance: USDC dividends are paid in a separate SEP-41 USDC (Stellar Asset Contract) and are not subject to RWA hooks. The RWA token's transfer into the lock contract is gated, so the lock contract must be a verified or allowlisted identity.

### Gaps
- Current numeric per-transaction limits (CPU instructions, read/write entries and bytes) and the current max TTL could not be retrieved; Stellar Lab renders them client-side. Run `stellar network settings` to get them.
- No Soroban-specific gas benchmark for accumulator versus Merkle claims was found.

## 5. Soroban dev tooling (October 2026)

### Takeaway
The toolchain is the Stellar CLI 28.1.0, soroban-sdk 29.0.1 stable (30.0.0-rc.1 out), Scaffold Stellar for full-stack scaffolding, Stellar Wallets Kit 2.6.0 for wallets, and Mercury, Goldsky, The Graph Substreams or other providers for indexing. Testnet runs protocol 29 behind RPC `soroban-testnet.stellar.org` and Friendbot.

### Cited Findings
- soroban-sdk: max stable 29.0.1 (2026-10-12); newest 30.0.0-rc.1 (2026-10-21); 29.0.0 on 2026-10-07; 28.0.0 on 2026-09-18. — [crates.io soroban-sdk](https://crates.io/api/v1/crates/soroban-sdk)
- stellar-cli: newest stable 28.1.0 (2026-09-26); 28.0.0 (2026-08-26); 27.1.0 (2026-07-31); 27.0.0 (2026-06-17). — [crates.io stellar-cli](https://crates.io/api/v1/crates/stellar-cli)
- Testnet RPC (live query 2026-10-25):
  - `https://soroban-testnet.stellar.org` `getNetwork` returns passphrase "Test SDF Network ; September 2015", protocolVersion 29, friendbotUrl `https://friendbot.stellar.org/`.
  - `getVersionInfo` returns RPC 30.0.0 with stellar-core 30.0.0 (built 2026-10-20).
  - `getFeeStats`: Soroban inclusion fee p50 100 stroops, p99 200.
  - — direct JSON-RPC query to https://soroban-testnet.stellar.org
- Scaffold Stellar:
  - Install with `cargo install --locked stellar-scaffold-cli` (or `cargo binstall stellar-scaffold-cli stellar-registry-cli`).
  - `stellar scaffold init my-project` creates sample contracts plus a frontend; then run `npm start`.
  - Can start from the OZ Wizard.
  - — [Stellar docs Scaffold Stellar](https://developers.stellar.org/docs/tools/scaffold-stellar)
- Repo AhaLabs/scaffold-stellar. Per a DeepWiki summary (secondary source), `init` also sets up OZ contracts and a `.env`. — [DeepWiki](https://deepwiki.com/AhaLabs/scaffold-stellar/1.2-getting-started)
- Stellar Wallets Kit `@creit-tech/stellar-wallets-kit` 2.6.0 (published about 2026-10-20 on JSR) supports Freighter, xBull, Albedo, Rabet, WalletConnect, Lobstr, Hana, Hot, Klever, OneKey and Bitget; the Stellar docs also list Ledger and Trezor. — [JSR](https://jsr.io/@creit-tech/stellar-wallets-kit); [Stellar wallets docs](https://developers.stellar.org/docs/tools/developer-tools/wallets)
- Network limits are visible in Stellar Lab (lab.stellar.org/network-limits). — [Stellar docs](https://developers.stellar.org/docs/reference/resource-limits-fees)
- Indexers listed by Stellar:
  - Mercury (Retroshades for Soroban; Mercury Classic GraphQL for contract events)
  - Goldsky Mirror pipelines (no Stellar Subgraphs)
  - The Graph Substreams (no Subgraphs)
  - SubQuery and OnFinality
  - Alchemy (Stellar Data API and RPC)
  - Allium (target Q1 2026)
  - OBSRVR and OBSRVR Flow (private beta)
  - Space and Time (Stellar since Q4 2025)
  - Horizon, which "will be deprecated"
  - Zephyr is not mentioned on this page.
  - — [Stellar indexers docs](https://developers.stellar.org/docs/data/indexers)
- Hooks uses Mercury for trade history and RPC for chain state. — [adrianvrj/hooks](https://github.com/adrianvrj/hooks)

### Inferences
- Use `stellar contract init`, `stellar contract build`, `stellar contract deploy` and `stellar contract bindings typescript` (standard CLI subcommands; not re-verified against 28.1.0 docs in this session) with `@stellar/stellar-sdk`. Watch for API changes across soroban-sdk majors (25 to 29 in 2026 alone) and match the OZ release's SDK version.
- Horizon is being deprecated, so build back-ends on Stellar RPC plus an indexer.

### Gaps
- Stellar Expert and StellarChain explorer feature details, Freighter's current version, and the RPC `getEvents` retention window were not retrieved. From prior knowledge, retention is about 7 days by default; unverified for 2026.
- Mainnet public RPC endpoints: SDF does not run a public mainnet Soroban RPC; use providers such as those listed above. This is from prior knowledge and was not re-verified.

## 6. Fees and resource model: cost of a Soroban transfer or invoke

### Takeaway
A Soroban call pays an inclusion fee (normally the 100-stroop minimum, 0.00001 XLM) plus a resource fee found by simulation. Historical measurements put typical state-changing invocations around 0.02–0.03 XLM in total (2024 data, possibly outdated). Mainnet inclusion fees remain at the minimum for most transactions (live query 2026-10-25).

### Cited Findings
- Fee formula: tx fee = resource fee + inclusion fee.
  - Minimum inclusion fee is 100 stroops per operation (0.00001 XLM). 1 XLM = 10,000,000 stroops.
  - Surge pricing applies when ledgers are full.
  - Simulate with `simulateTransaction` to get the resource fee.
  - — [Stellar fees & metering](https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering)
- 2024 Cheesecake Labs analysis of 220 transactions: average minimum resource fee about 215,000 stroops (0.0215 XLM); ledger-modifying calls averaged 261,052 stroops (about 0.026 XLM). Possibly outdated: fee parameters have changed through protocol upgrades since then. — [Cheesecake Labs](https://cheesecakelabs.com/blog/how-much-do-soroban-fees-cost/)
- Fordefi adds a safety buffer on top of simulated resource fees. — [Fordefi docs](https://docs.fordefi.com/user-guide/manage-transactions/understand-transaction-fees/stellar-fees)
- Mainnet Horizon `fee_stats` (live query 2026-10-25): last base fee 100 stroops; ledger capacity usage 0.88; fee charged p50 100 stroops, p70 3,483, p99 8,604, max 32,830. These are mainly classic and inclusion figures. — direct query to https://horizon.stellar.org/fee_stats
- Testnet Soroban inclusion fee p50 100, p99 200 stroops (live query 2026-10-25). — direct JSON-RPC to soroban-testnet.stellar.org

### Inferences
- Budget roughly 0.01–0.05 XLM per user action:
  - small: a SEP-41 transfer or a claim
  - larger: a bonding-curve buy that touches the curve state, the token and USDC
  - largest: graduation, a multi-contract call (curve, token, Soroswap router, factory, pair), which could approach per-transaction limits and should be simulated early.
- Fee abstraction (OZ `stellar-fee-abstraction`, Fee Forwarder) or sponsored-fee wallets (such as Cavos in Hooks) can hide XLM fees from equity investors.

### Gaps
- No 2026 measurement of a SEP-41 transfer's resource fee was found. Simulating one on testnet would give a current figure.
