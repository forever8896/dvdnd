# Stellar ZK, Smart Wallets, and Identity/Compliance Tooling for a Tokenized Private-Equity Platform

Research date: 2026-10-25. Scope: privacy-preserving investor eligibility ("not a US person"), company/KYB verification, seedless onboarding on Stellar/Soroban, for the "Stellar Unlocked" hackathon track (Poseidon + BN254).

## 1. BN254 / Poseidon / BLS12-381 host functions in Soroban: CAPs, operations, status, verifier examples, cost

### Takeaway
BN254 (CAP-74) and Poseidon/Poseidon2 (CAP-75) went live on mainnet with Protocol 25 "X-Ray" on 2026-01-22. Protocol 26 added CAP-80 on 2026-05-06: BN254 G1 MSM, Fr scalar arithmetic and on-curve checks. BLS12-381 has been live since Protocol 22 (CAP-59, Dec 2024). So in Oct 2026, Groth16 (BN254 or BLS12-381) and Noir UltraHonk verification both work on mainnet. There are official example contracts. A Groth16 verify costs roughly 12M CPU instructions (one unverified claim). An optimized UltraHonk verify costs about 80M of the 400M per-transaction limit.

### Cited Findings
**Protocol timeline (official software-versions page)**
- Protocol 22: mainnet 2024-12-05. Includes CAP-58 (constructors) and CAP-59 (BLS12-381 host functions). — [Stellar Software Versions](https://developers.stellar.org/docs/networks/software-versions)
- Protocol 25 "X-Ray": testnet 2026-01-07, mainnet 2026-01-22. Includes CAP-74 (BN254 elliptic-curve operations) and CAP-75 (Poseidon/Poseidon2 primitives). — [Stellar Software Versions](https://developers.stellar.org/docs/networks/software-versions); [X-Ray announcement](https://stellar.org/blog/developers/announcing-stellar-x-ray-protocol-25)
- Protocol 26: testnet 2026-04-16, mainnet 2026-05-06. Includes CAP-73, 77, 78, 79, CAP-80 ("ZK BN254 use cases") and CAP-82 (checked 256-bit arithmetic). — [Stellar Software Versions](https://developers.stellar.org/docs/networks/software-versions)
- Protocol 27: mainnet 2026-07-08. Includes CAP-71 (authentication delegation and address-bound credentials). Protocol 28 reached mainnet 2026-09-16. Protocol 29 (security fixes only, no new CAPs) was scheduled for testnet 2026-09-29 and mainnet 2026-10-01. — [Stellar Software Versions](https://developers.stellar.org/docs/networks/software-versions)
- secp256r1 (passkey) signature verification is CAP-51, from Protocol 21. — [Stellar Software Versions](https://developers.stellar.org/docs/networks/software-versions)

**CAP-74 (BN254), Protocol 25**
- Adds three host functions: `bn254_g1_add`, `bn254_g1_mul` and `bn254_multi_pairing_check`. They are designed to match Ethereum's EIP-196/EIP-197 precompiles, so Ethereum-targeted Groth16/PLONK verifiers port directly. — [X-Ray announcement](https://stellar.org/blog/announcing-stellar-x-ray-protocol-25); [CAP-0074](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md)
- In the SDK docs these appear as `g1_add`, `g1_mul` and `pairing_check` (a pairing check over lists of G1 and G2 points). — [Stellar ZK docs](https://developers.stellar.org/docs/build/apps/zk); [soroban-sdk v25 BN254 migration notes](https://docs.rs/soroban-sdk/latest/soroban_sdk/_migrating/v25_bn254/index.html)

**CAP-75 (Poseidon/Poseidon2), Protocol 25**
- Adds `poseidon_permutation` and `poseidon2_permutation`. These are permutations only, not full hash functions; you build the sponge or hash on top. In soroban-sdk they sit behind `CryptoHazmat` and require the `hazmat-crypto` feature. Ready-made Poseidon hashes (circom-compatible, intended to match Circom/Noir) are in [stellar/rs-soroban-poseidon](https://github.com/stellar/rs-soroban-poseidon). — [Stellar ZK docs](https://developers.stellar.org/docs/build/apps/zk); [CAP-0075](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0075.md); [soroban-sdk v25 Poseidon notes](https://docs.rs/soroban-sdk/latest/soroban_sdk/_migrating/v25_poseidon/index.html)

**CAP-80, Protocol 26 (status: Final)**
- Adds nine host functions: `bn254_g1_msm(vp, vs) -> Bytes` (64-byte uncompressed point); `bn254_fr_add`, `bn254_fr_sub`, `bn254_fr_mul`, `bn254_fr_pow(U256, u64)` and `bn254_fr_inv` (all mod r); `bn254_g1_is_on_curve`; `bls12_381_g1_is_on_curve` and `bls12_381_g2_is_on_curve` (no subgroup check). It adds no BLS12-381 MSM or Fr functions, because BLS12-381 arithmetic already existed under CAP-59. — [CAP-0080](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0080.md)

**Verifier contracts and repos**
- [stellar/soroban-examples `groth16_verifier`](https://github.com/stellar/soroban-examples/tree/main/groth16_verifier) has separate BLS12-381 and BN254 contracts. The interface is `verify_proof(verification_key, proof, public_inputs)`, with public inputs typed `Vec<Bn254Fr>` or `Vec<Bls12381Fr>`. Fixtures are snarkjs-compatible JSON (`verification_key.json`, `proof.json`, `public.json`) produced from Circom, Gnark, Arkworks or Noname. BLS12-381 is tested with Circom, Gnark and Arkworks fixtures; BN254 only with Gnark fixtures. The repo marks it demo-only and unaudited. It references `soroban-verifier-gen`, which generates a verifier from a verification key. — [soroban-examples groth16_verifier](https://github.com/stellar/soroban-examples/tree/main/groth16_verifier)
- P25 preview examples: [jayz22/soroban-examples p25-preview](https://github.com/jayz22/soroban-examples/tree/p25-preview/p25-preview). — [Stellar ZK docs](https://developers.stellar.org/docs/build/apps/zk)
- Noir UltraHonk verifiers: [indextree/ultrahonk_soroban_contract](https://github.com/indextree/ultrahonk_soroban_contract) (linked from the Stellar docs) and [NethermindEth/rs-soroban-ultrahonk](https://github.com/NethermindEth/rs-soroban-ultrahonk) (optimized, with example circuits). — [Stellar ZK docs](https://developers.stellar.org/docs/build/apps/zk); [Nethermind blog, 2026-08-04](https://www.nethermind.io/blog/making-noir-verification-cheaper-on-stellar)
- The Stellar docs also name RISC Zero as a proving system whose proofs can be verified on Stellar. — [Stellar ZK docs](https://developers.stellar.org/docs/build/apps/zk)
- stellar-zk (salazarsebas) is a community CLI. It generates Soroban verifiers with BN254 pairing checks, nullifier tracking and events, and claims about 12M CPU instructions (about 1,100 stroops) per Groth16 verification. I have not verified this figure. — [stellar-zk listing](https://awesome.ecosyste.ms/projects/github.com%2Fsalazarsebas%2Fstellar-zk)
- An official agent skill file covers ZK on Stellar. It still labels CAP-74/75 as "proposed/status-sensitive", which is stale given the software-versions page. — [skills.stellar.org zk-proofs](https://skills.stellar.org/skills/zk-proofs/SKILL.md)

**Cost data (Nethermind, Noir UltraHonk on Soroban)**
- Baseline verify: 224.8M CPU instructions, 56% of the 400M per-transaction limit.
- With CAP-80 host Fr arithmetic: 135.8M. After guest cleanups: 126.7M. With native G1 MSM: 79.96M, a 64.4% reduction.
- Min resource fee on localnet fell from 0.235 to 0.090 XLM. WASM size fell from 66 KB to 25 KB.
- A live testnet "tornado" verifier used 82.06M instructions at a fee of 0.01242 XLM.
- Across eight circuits the range was about 79.9M to 82.1M instructions (about 20% of the limit).
- The per-transaction cap is 400M CPU instructions on Protocols 26 and 27.
— [Nethermind blog](https://www.nethermind.io/blog/making-noir-verification-cheaper-on-stellar)

### Inferences
- For a hackathon, Circom + snarkjs Groth16 on BN254 is the cheapest and simplest on-chain path: a constant 3-point proof and a single multi-pairing check. You can start from the soroban-examples BN254 contract. UltraHonk avoids a per-circuit trusted setup but costs about 6-7x more CPU.
- Poseidon on-chain lets the contract recompute commitments, Merkle roots and nullifiers that match the circuit's Poseidon. This is the exact feature the track highlights. Use rs-soroban-poseidon so parameters match circomlib.
- Because the BN254 example has only been tested with Gnark fixtures, test the snarkjs BN254 JSON parsing early (G2 coordinate ordering is a classic pitfall).

### Gaps
- I found no official SDF benchmark for a Groth16 BN254 verify. The ~12M instruction figure is a single community claim.
- I did not confirm whether the soroban-examples BN254 contract has been updated to use CAP-80 MSM for the public-input linear combination.
- I found no PLONK (snarkjs/halo2 KZG) verifier for Soroban.

## 2. ZK identity proof systems (zkPassport, Self, Anon Aadhaar, Privado ID, Semaphore, Noir/Circom) and a hackathon path

### Takeaway
No zkPassport or Self integration with Stellar/Soroban exists that I could find. Both target EVM, with verification off-chain or on EVM. The practical hackathon path has two variants. (a) Verify a zkPassport/Self proof off-chain with their SDK, then have the platform sign an on-chain attestation. (b) The more "Stellar Unlocked"-native option: write your own Circom (Groth16/BN254) or Noir circuit. It proves the holder has a KYC-provider-signed credential whose country field is not in a blocked set, and outputs a Poseidon nullifier bound to their Stellar address. Verify it on Soroban.

### Cited Findings
- **zkPassport** lets a user prove attributes such as age, nationality or sanctions status from a passport/ID NFC chip. Proofs are generated on the device and the data stays local. The SDK and on-chain registry contracts target Ethereum. — [ethereum.org zkPassport](https://ethereum.org/developers/tools/zkpassport/); [Safe Research comparison](https://safefoundation.org/blog/safe-research-zk-passport-where-are-we-now)
- zkPassport SDK: `npm install @zkpassport/sdk @zkpassport/ui`, with a `VerifyWithZKPassport` button. The query object supports `min`/`max`, `included`/`excluded` country sets and `disclose: true`. On the server, call `new ZKPassport("domain").createQuery()...done()` then `verify()`. The docs advise recreating the query on the server rather than trusting the browser. — [zkPassport quick start](https://docs.zkpassport.id/getting-started/quick-start)
- zkPassport repos: `circuits` (Apache-2.0), `zkpassport-packages` monorepo, `zkpassport-proof-verifier` ("Verifier API") and Noir libraries (`noir_rs`, `noir-ecdsa`, `noir_rsa`, `noir_json_parser`), which indicates Noir circuits. The old `zkpassport-sdk` repo is archived. — [github.com/zkpassport](https://github.com/zkpassport)
- One third-party listing says the zkPassport founders joined Aztec Labs. This is unverified. — [thegrid.id](https://thegrid.id/profiles/zkpassport)
- **Self (self.xyz)** proves age, nationality, sanctions status and personhood without exposing the document. It now leads with "Self Enterprise" (`@selfxyz/enterprise-sdk` v0.4.1), including a "Pre-KYC" workspace that screens out ineligible users (25 credits). "Self Pass" is now legacy. — [Self docs](https://docs.self.xyz/)
- Self Pass legacy supports passports, national IDs, Aadhaar and KYC attestations. It has a `SelfBackendVerifier` Node SDK, a Celo testnet faucet, LayerZero/Hyperlane cross-chain examples and an SBT example (`SelfPassportERC721.sol`). Boilerplate: [selfxyz/self-integration-boilerplate](https://github.com/selfxyz/self-integration-boilerplate). — [Self Pass docs](https://docs.self.xyz/docs/self-pass/)
- Self's verification config takes a minimum age, excluded ISO-3166 alpha-3 country codes and an OFAC level. This comes from a community mirror of Self's MCP server, not the SDK reference. — [Glama Self MCP generate_config_id](https://glama.ai/mcp/servers/selfxyz/self-mcp/tools/generate_config_id)
- **Stellar-native analogue:** ProofPass is a Stellar/Soroban project for ZK credentials focused on age, not nationality. — [ProofPass repo](https://github.com/AlphaMaleBaDI/ProofPass)
- **Analogous design on another chain:** identiPay (Sui) uses Groth16/BN254 predicate proofs such as "age >= 21", where the verifier learns only the predicate truth. This is the pattern for "country not in set". — [identiPay zk-verifier](https://www.mintlify.com/krsultov/identiPay/protocol/zk-verifier)
- The Stellar docs list Noir and RISC Zero as supported proving systems for on-chain verification on Stellar. — [Stellar ZK docs](https://developers.stellar.org/docs/build/apps/zk)

### Inferences
**Which systems produce BN254-verifiable proofs**
- Circom/snarkjs Groth16: native BN254, Soroban-ready via `groth16_verifier`.
- Noir/Barretenberg UltraHonk: BN254 KZG, Soroban-ready via the Nethermind and indextree verifiers.
- Semaphore: Circom Groth16 on BN254, so it should be portable using CAP-74 plus Poseidon.
- Anon Aadhaar and Privado ID (Polygon ID, Iden3 circuits): also Circom Groth16 on BN254, but they use Poseidon plus BabyJubjub EdDSA, so they are portable in principle. I did not confirm this from sources in this session; it is from background knowledge.
- Self's legacy circuits are Circom-based (its predecessor OpenPassport used Circom), but its Celo-deployed verifiers have not been ported. zkPassport's circuits appear to be Noir, so in principle an UltraHonk Soroban verifier could check them. That would need matching verification keys and a registry of passport-signing-authority (CSCA) roots on Stellar, which is non-trivial.

**Recommended hackathon architecture ("attested-credential + ZK")**
1. The user completes KYC with a provider (Sumsub, Didit, etc.) or a zkPassport/Self check. The platform's issuer backend signs a credential: `Poseidon(country_code, residence_code, dob, kyc_level, expiry, secret)` signed with EdDSA-BabyJubjub (circomlib `EdDSAPoseidonVerifier`). Alternatively, insert the credential commitment into a Poseidon Merkle tree whose root is stored in a Soroban "issuer registry" contract.
2. The Circom circuit privately checks the signature or Merkle membership. It publicly proves `residence_country ∉ {USA, plus any sanctioned set}`, `expiry > now` and optionally `kyc_level >= X`. It outputs `nullifier = Poseidon(secret, offering_id)` and binds to the investor's Stellar address as a public input, to stop proof replay or front-running.
3. The Soroban gate contract verifies the Groth16 proof with BN254 `pairing_check` (plus `g1_msm` for public inputs). It checks the Merkle root against the registry using Poseidon host functions, stores the nullifier, and marks the address as eligible. The token's compliance hook (see OpenZeppelin RWA below) then allows transfers only to eligible addresses.
- This shows off both highlighted host functions (Poseidon + BN254). The platform never learns nationality on-chain, and the issuer's view can be kept minimal.

### Gaps
- I could not confirm Self's current proof system and curve or its on-chain chains from the official docs; the pages fetched were overview-only.
- I could not reach zkPassport's on-chain verification page (404). Its EVM verifier format and cost are unconfirmed, and so is whether its proof is UltraHonk.
- I found no Stellar port of Semaphore, Anon Aadhaar, Privado ID, zkPassport or Self.

## 3. KYC/KYB providers, SEP-12/Anchor Platform, and credible proof of company ownership

### Takeaway
SEP-12 is Stellar's standard KYC API: GET/PUT `/customer`, signed callbacks and SEP-10/45 auth. It suits a regulated anchor-style flow but does nothing for privacy, so treat it as the issuer-side intake. For on-chain gating, OpenZeppelin's Stellar RWA suite (T-REX/ERC-3643 port) provides an identity-verifier module with claim topics and trusted issuers, which is where a ZK-derived "eligible" claim could plug in. Company ownership is most credibly shown by layering several checks: a registry director/UBO match, an LEI, domain control (DNS TXT or a stellar.toml/SEP-1 `home_domain` signing key), and a KYB vendor report.

### Cited Findings
- **SEP-12 v1.15.0 (Active):**
  - Endpoints: GET `/customer` (required fields or status), PUT `/customer` (idempotent upload), PUT `/customer/callback`, DELETE `/customer/[account]`, and optional `/customer/files`. Verification codes now go through PUT `/customer` with a `_verification` suffix.
  - All endpoints require SEP-10 or SEP-45 JWT auth.
  - Statuses: ACCEPTED, PROCESSING, NEEDS_INFO, REJECTED. The `type` parameter allows a different status per action.
  - Callbacks are signed with the anchor's `SIGNING_KEY` from stellar.toml, and wallets should reject stale timestamps (1-2 minute window).
  - Field names follow SEP-9, including `organization.*` fields.
  — [SEP-0012](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0012.md)
- **OpenZeppelin Stellar RWA suite:** based on T-REX/ERC-3643. It includes an identity verifier that checks claims for required topics (KYC, AML, etc.) signed by registered trusted claim issuers, enforced on transfer, mint and burn, plus external compliance hooks and recovery. The RWA Wizard scaffolds this. OpenZeppelin and T-REX Network announced that a Stellar-native ERC-3643 implementation is complete. — [OZ RWA docs](https://docs.openzeppelin.com/stellar-contracts/tokens/rwa/rwa); [OZ RWA Wizard post](https://openzeppelin.com/news/rwa-wizard-issue-regulated-real-world-assets-on-stellar); [OZ x T-REX partnership](https://www.openzeppelin.com/news/openzeppelin-and-trex-network-partner-to-advance-institutional-compliance-infrastructure); [DeepWiki identity verifier](https://deepwiki.com/OpenZeppelin/stellar-contracts/2.3.3.1-identity-verifier)

### Inferences
**KYC vendors (from background knowledge, not verified this session)**
- Sumsub, Persona, Onfido (Entrust), Veriff and Didit all offer document + liveness KYC, webhooks and Node SDKs.
- Sumsub and Persona also offer KYB with UBO discovery.
- Didit advertises a free core KYC tier, which suits a hackathon.
- Any of them can feed the issuer backend that signs the ZK credential, via webhook → sign credential.

**Company ownership verification ladder (strongest first)**
1. Registry check: UK Companies House API (free, with officers and PSC/beneficial-owner endpoints) or OpenCorporates for other jurisdictions. Match the KYC'd individual's name and DOB to a listed director or PSC.
2. GLEIF LEI lookup (free API). vLEI (ACDC/KERI credentials) can cryptographically bind a person's role to an LEI, the most "crypto-native" credible option.
3. Domain control: a DNS TXT record containing the issuer's Stellar address, or hosting `/.well-known/stellar.toml` (SEP-1) with an `[[DOCUMENTATION]]` / `ORG_*` section, then setting the issuer account's `home_domain` to that domain. This proves domain control, not legal ownership.
4. A KYB vendor report (Sumsub/Persona) as the commercial backstop.
- A ZK twist: the platform's issuer signs a "company-verified" credential, and company tokens are minted only by an issuer address bound to that credential.

### Gaps
- I did not fetch vendor pages (Sumsub, Persona, Onfido, Veriff, Didit), Companies House, GLEIF/vLEI or Anchor Platform docs this session. Vendor pricing, KYB coverage and Anchor Platform KYC-callback specifics are unverified.
- I did not fetch the SEP-9 organization field list (registration number, director names, etc.).

## 4. Smart wallets and seedless onboarding: passkeys, fee sponsorship, quickest Next.js path

### Takeaway
In Oct 2026 the canonical path is `smart-account-kit`, now at [github.com/stellar/smart-account-kit](https://github.com/stellar/smart-account-kit). It is a TypeScript passkey SDK over OpenZeppelin's `stellar-contracts` smart account, with policies such as spending limits. Pair it with the OpenZeppelin Relayer / Channels service for gasless transactions. Launchtube is being discontinued in favor of the OZ Relayer. The older `passkey-kit` (kalepail) still works but is not compatible with the OZ account model.

### Cited Findings
- Contract accounts use `__check_auth` for custom auth (passkeys/WebAuthn, spend caps, allow lists, timelocks). They cannot pay their own fees, so they need fee sponsorship. Exchanges don't currently support withdrawals from contract accounts. — [Stellar smart wallets docs](https://developers.stellar.org/docs/build/apps/smart-wallets)
- **smart-account-kit:**
  - A TypeScript SDK for OpenZeppelin `stellar-contracts` smart accounts.
  - Signers: passkeys (secp256r1), Ed25519 and delegated G-address signers.
  - Typed policy clients: threshold, weighted-threshold and spending-limit (scoped to a token contract).
  - Optional relayer proxy for gasless transactions, and IndexedDB storage plus a demo app.
  - Install with `pnpm add smart-account-kit`. Apache-2.0.
  - The kalepail repo is archived; development moved to stellar/smart-account-kit, which has Protocol 27 deployment docs.
  — [kalepail/smart-account-kit](https://github.com/kalepail/smart-account-kit)
- **OZ smart account:** authorization is composed from context rules (scope, lifetime, required signers/policies), signers (delegated, or external and validated by verifier contracts such as Ed25519 and WebAuthn/P256) and policies (spending limit, threshold, weighted threshold). Version caveat: v0.8.0 changed the signed digest, so v0.7.x clients can't authorize v0.8.0 accounts; pair them with `stellar-accounts` v0.7.3 until clients update. Source: [OpenZeppelin/stellar-contracts packages/accounts](https://github.com/OpenZeppelin/stellar-contracts/tree/main/packages/accounts). — [OZ smart account docs](https://docs.openzeppelin.com/stellar-contracts/accounts/smart-account)
- **passkey-kit (kalepail):** a TypeScript SDK for passkey smart wallets with a `PasskeyServer` that submits through a relayer. Its flat signature model is not drop-in compatible with smart-account-kit, and its README advises reviewing the code before holding meaningful value. — [passkey-kit README](https://cdn.jsdelivr.net/npm/passkey-kit@0.14.0/README.md)
- **Launchtube** is being discontinued by SDF in favor of the OpenZeppelin Relayer ("Stellar Channels Service"), which SDF says has more maturity, scalability and auditing. I found no shutdown date. — [Stellar docs: OpenZeppelin Relayer](https://developers.stellar.org/docs/tools/openzeppelin-relayer)
- **OZ Channels:** free under a fair-use policy, with gas paid by the service and a managed pool of channel accounts. Client package: `@openzeppelin/relayer-plugin-channels`, using an API key with testnet and mainnet endpoints. — [OZ Channels guide](https://docs.openzeppelin.com/relayer/guides/stellar-channels-guide)
- **OZ hosted Stellar Relayer (announced 2026-03-24):** sponsored transactions wrap the user's transaction in a fee-bump envelope signed by a fund account. It can also charge the user in a token while the relayer pays XLM. — [OZ news](https://www.openzeppelin.com/news/expanding-stellar-support-with-relayer-service); [OZ sponsored tx guide](https://docs.openzeppelin.com/relayer/1.5.x/guides/stellar-sponsored-transactions-guide)
- Native fee-bump transactions allow self-hosted sponsorship with no third party. — [Dfns: fee sponsor on Stellar](https://www.dfns.co/article/fee-sponsor-on-stellar)
- A community-fund proposal for a passkey module in Stellar Wallets Kit (Creit Tech) was still pending merge. — [SCF submission](https://communityfund.stellar.org/submissions/recKoOv9KoxgFTDE8)

### Inferences
- **Quickest Next.js demo:** smart-account-kit in a client component (passkey create/sign uses WebAuthn, so it must run in the browser). Put a Next.js route handler as the relayer proxy so the OZ Channels API key stays server-side. Install a spending-limit policy to show "safe for non-crypto users".
- For users who want email/social login rather than passkeys: Privy, Crossmint and Dynamic offer embedded wallets. I did not verify their Stellar support or status this session.
- Use Freighter or Stellar Wallets Kit as the "bring your own wallet" option for crypto-native investors.
- Note the "exchanges don't support contract accounts" limitation: dividend payouts to C-addresses are fine on-chain, but users cannot withdraw directly from them to a CEX.

### Gaps
- I did not verify Crossmint, Privy or Dynamic Stellar/Soroban smart-wallet support, or Stellar Wallets Kit's current passkey status, for Oct 2026.
- No Launchtube shutdown date was found.
- I did not confirm whether the OZ WebAuthn verifier contract is audited.

## 5. Regulatory framing: what the eligibility check must actually prove

### Takeaway
Under Regulation S, "U.S. person" is based on residence (natural persons) or place of organization (entities), not nationality. A "nationality ≠ USA" proof is therefore both over- and under-inclusive: a US citizen living abroad is generally not a Reg S US person, and a French national living in New York is one. The check should prove non-US residence and offshore location at purchase (plus entity domicile for companies), ideally alongside sanctions screening. Nationality-only passport proofs (zkPassport/Self) need a residence proof added, such as an address-verified KYC credential, an IP/geolocation attestation, or a self-certification.

### Cited Findings
- Reg S §230.902(k)(1): a U.S. person includes "any natural person resident in the United States". It also includes any partnership or corporation organized under US law, estates and trusts with US executors or trustees, US agencies or branches of foreign entities, certain dealer or fiduciary accounts, and foreign entities formed mainly by US persons to invest in unregistered securities. — [17 CFR 230.902 (Cornell LII)](https://www.law.cornell.edu/cfr/text/17/230.902)
- §230.902(k)(2) exclusions include certain discretionary accounts held for non-US persons by US fiduciaries, foreign-law employee benefit plans, US bank or insurer branches abroad, and international organizations such as the IMF, World Bank and UN. — [17 CFR 230.902](https://www.law.cornell.edu/cfr/text/17/230.902)
- An "offshore transaction" requires that the offer is not made to a person in the US, and that the buyer is outside the US when the order is placed (or the seller reasonably believes so) or the trade happens on a designated offshore market. "Directed selling efforts" means any activity that could condition the US market, for example ads in publications with general US circulation. The distribution compliance period lengths are in §230.903. — [17 CFR 230.902](https://www.law.cornell.edu/cfr/text/17/230.902)

### Inferences
- **What the circuit should assert:**
  - `residence_country != US`
  - `entity_incorporation_country != US` for corporate investors
  - not on sanctions lists
  - the credential is fresh (unexpired) and issued by a trusted KYC issuer
  - plus a front-end geofence or attestation that the investor is offshore at order time
- Because Reg S tokens carry a distribution compliance period (and resale limits for Category 3 equity of US issuers), an on-chain transfer hook restricting transfers to eligible addresses mirrors the requirement. The ERC-3643/OZ RWA compliance module is the natural fit.
- **Alternatives:**
  - Reg D 506(c) allows US accredited investors with "reasonable steps" verification, a heavier, non-ZK-friendly check (income and net worth).
  - Reg CF allows retail but requires a registered funding portal or broker-dealer.
  - Excluding US persons avoids both.
- **MiCA:** tokenized equity that qualifies as a transferable security under MiFID II is excluded from MiCA (MiCA covers asset-referenced tokens, e-money tokens and other crypto-assets). The EU path for security tokens is MiFID II/Prospectus Regulation and the DLT Pilot Regime. The eligibility check for EU investors is therefore driven by suitability/appropriateness and prospectus exemptions (e.g., qualified investors or fewer than 150 persons per member state), not MiCA. This is from background knowledge and was not sourced this session.

### Gaps
- I did not fetch SEC pages for Reg D/Reg CF thresholds, §230.903 compliance-period durations or MiCA (Regulation (EU) 2023/1114) text this session; the SEC Reg S overview URL returned 404. These statements should be checked before relying on them.
- This is not legal advice. Whether a ZK residence proof plus issuer KYC records meets "reasonable belief" for offshore status is untested.
