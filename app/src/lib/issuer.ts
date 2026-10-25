// The credential issuer (server only). Builds the investor's leaf from the
// residence country a KYC check verified and the commitment Poseidon(secret)
// the browser sent, then adds it to the gate's on-chain Merkle tree with the
// platform key. It never sees the secret, so it can't prove for the investor.
//
// It first records the identity on the platform account (a data entry keyed
// by a hash of the ID document), so one verified person gets one credential.

import "server-only";
import { createHash } from "node:crypto";
import { Operation } from "@stellar/stellar-sdk";
import { sc } from "./chain";
import { CONTRACTS } from "./config";
import { isoNumeric } from "./iso3166";
import { classic, horizon, invoke, Keypair, keypairSigner, type Signer } from "./stellar";
import { BLOCKED_COUNTRIES, FR_MODULUS, leafFromCommitment } from "./zk";

const CREDENTIAL_LIFETIME = 365 * 86400;

export class IssueError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly ineligible = false,
    /** Refused as a US resident (who can still invest as an accredited investor), not a sanctioned country. */
    public readonly us = false,
  ) {
    super(message);
  }
}

export type Issued = { index: number; hash: string; leaf: string; country: number; expiry: number };

function platform(): Signer {
  const secret = process.env.DVDND_ADMIN_SECRET;
  if (!secret) throw new IssueError("The credential issuer is not configured.", 500);
  return keypairSigner(Keypair.fromSecret(secret));
}

export function parseCommitment(value: unknown): bigint {
  let c: bigint;
  try {
    c = BigInt(typeof value === "string" ? value : "");
  } catch {
    throw new IssueError("Invalid commitment.", 400);
  }
  if (c <= 0n || c >= FR_MODULUS) throw new IssueError("Invalid commitment.", 400);
  return c;
}

/** ISO numeric code for a country given as numeric, alpha-2 or alpha-3. */
export function countryCode(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? isoNumeric(value) : null;
  if (!n || !Number.isInteger(n)) throw new IssueError("Unknown country of residence.", 422);
  return n;
}

/** An identity a credential is claimed for: the provider and its stable id for the person. */
export type Claim = { source: "didit"; id: string };

const claimKey = (c: Claim) => `${c.source}:${createHash("sha256").update(c.id).digest("base64")}`;

/** Adds the investor's credential leaf on-chain. A `claim` makes it one per verified identity. */
export async function issueCredential(country: number, commitment: bigint, claim?: Claim): Promise<Issued> {
  if (country === 840) {
    throw new IssueError("US residents can't hold a Reg S credential; invest as an accredited investor instead.", 403, true, true);
  }
  if (BLOCKED_COUNTRIES.includes(country)) {
    throw new IssueError("dvdnd isn't available to residents of this country.", 403, true);
  }
  const issuer = platform();
  const key = claim ? claimKey(claim) : null;
  if (key) {
    const account = await horizon.loadAccount(issuer.publicKey);
    if (account.data_attr[key]) throw new IssueError("This identity already has a dvdnd credential.", 409);
    await classic(issuer, [Operation.manageData({ name: key, value: String(Math.floor(Date.now() / 1000)) })]);
  }
  const expiry = Math.floor(Date.now() / 1000) + CREDENTIAL_LIFETIME;
  const leaf = await leafFromCommitment(country, expiry, commitment);
  try {
    const res = await invoke(issuer, CONTRACTS.gate, "add_credential", [sc.u256(leaf)]);
    return { index: Number(res.returnValue), hash: res.hash, leaf: leaf.toString(), country, expiry };
  } catch (e) {
    // Release the claim so the person can try again.
    if (key) await classic(issuer, [Operation.manageData({ name: key, value: null })]).catch(() => {});
    throw e;
  }
}
