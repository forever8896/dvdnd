// Company-side flows: register, sign the agreement, issue the share token
// and open a raise. Mirrors scripts/testnet/demo-company.sh, in the browser.

import { Asset, AuthClawbackEnabledFlag, AuthRequiredFlag, AuthRevocableFlag, Operation } from "@stellar/stellar-sdk";
import {
  companyCount,
  encodeProfile,
  getCompany,
  listListings,
  sc,
  type Company,
  type Listing,
  type Profile,
} from "./chain";
import { CONTRACTS, NETWORK, SITE_DOMAIN } from "./config";
import {
  balances,
  classic,
  friendbot,
  invoke,
  Keypair,
  keypairSigner,
  ops,
  sorobanOp,
  type Signer,
  type TxResult,
} from "./stellar";

/** The company this wallet owns, if any (latest registration wins). */
export async function findMyCompany(owner: string): Promise<Company | null> {
  const n = await companyCount();
  const all = await Promise.all(Array.from({ length: n }, (_, i) => getCompany(i + 1)));
  return all.filter((c) => c.owner === owner).at(-1) ?? null;
}

export async function myListings(companyId: number): Promise<Listing[]> {
  return (await listListings()).filter((l) => l.company.id === companyId);
}

export async function register(s: Signer, name: string, country: number, profile: Profile) {
  const res = await invoke(s, CONTRACTS.registry, "register", [
    sc.address(s.publicKey),
    sc.string(name),
    sc.u32(country),
    sc.string(encodeProfile(profile)),
  ]);
  return { ...res, id: Number(res.returnValue) };
}

export async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/** The plain-language agreement the company signs; its SHA-256 goes on-chain. */
export function agreementText(c: { name: string; payoutPct: number; periodLabel: string }) {
  return [
    `dvdnd profit-share agreement`,
    `Company: ${c.name}`,
    `1. The company commits ${c.payoutPct}% of its audited yearly net profit to holders of its dvdnd token.`,
    `2. Dividends are paid in USDC on Stellar, ${c.periodLabel.toLowerCase()}, to tokens locked for the full period, pro-rata.`,
    `3. The commitment lasts for as long as the business operates.`,
    `4. If the business is sold, the obligation transfers to the buyer.`,
    `5. Late payments are flagged publicly on the company's listing.`,
    `6. The company holds no tokens and receives the raise, minus the platform's 5% fee, only if the minimum is reached.`,
  ].join("\n");
}

export async function signAgreement(s: Signer, companyId: number, hash: Uint8Array, payoutBps: number, periodSecs: number) {
  return invoke(s, CONTRACTS.registry, "sign_agreement", [
    sc.u32(companyId),
    sc.bytes(hash),
    sc.u32(payoutBps),
    sc.u64(periodSecs),
  ]);
}

export type IssueProgress = (step: string, tx?: TxResult) => void;

/**
 * Issues the company's share token: a fresh issuer account with
 * AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED, its Stellar Asset
 * Contract, and the SAC admin handed to the offering contract so only verified
 * investors can hold it and supply is fixed by code.
 */
export async function issueShareToken(code: string, progress: IssueProgress) {
  const issuer = Keypair.random();
  const issuerSigner = keypairSigner(issuer);
  progress("Creating the token issuer account");
  await friendbot(issuer.publicKey());

  progress("Setting compliance flags");
  const flags = await classic(issuerSigner, [
    Operation.setOptions({
      setFlags: (AuthRequiredFlag | AuthRevocableFlag | AuthClawbackEnabledFlag) as 1,
      // Wallets find the token's details in dvdnd's stellar.toml through this.
      homeDomain: SITE_DOMAIN,
    }),
  ]);
  progress("Compliance flags set", flags);

  const asset = new Asset(code, issuer.publicKey());
  progress("Deploying the Stellar Asset Contract");
  const deployed = await sorobanOp(issuerSigner, Operation.createStellarAssetContract({ asset }));
  const token = asset.contractId(NETWORK.passphrase);
  progress("Share token contract deployed", deployed);

  progress("Handing token admin to the offering contract");
  const admin = await invoke(issuerSigner, token, "set_admin", [sc.address(CONTRACTS.offering)]);
  progress("Offering contract is now the token admin", admin);

  return { token, issuerSecret: issuer.secret() };
}

export async function openRaise(
  s: Signer,
  r: { companyId: number; token: string; price: bigint; min: bigint; max: bigint; deadline: number },
) {
  // The company receives the raise and pays dividends in USDC.
  if ((await balances(s.publicKey)).usdc === null) await classic(s, [ops.trustUsdc()]);
  const res = await invoke(s, CONTRACTS.offering, "open_raise", [
    sc.u32(r.companyId),
    sc.address(r.token),
    sc.i128(r.price),
    sc.i128(r.min),
    sc.i128(r.max),
    sc.u64(r.deadline),
  ]);
  return { ...res, raiseId: Number(res.returnValue) };
}

/** A 4–12 character asset code from the company name. */
export function assetCode(name: string) {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (letters.slice(0, 8) || "DVDND") + Math.floor(Math.random() * 90 + 10);
}
