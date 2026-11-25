// Browser side of the residence proof. Mirrors circuits/scripts/lib.mjs and
// the gate contract: Poseidon credential leaves, the incremental Merkle tree,
// address hashing and the Soroban byte encodings. The leaf commits to
// Poseidon(secret), so the issuer builds it without seeing the secret.

import { Address, hash as sha256, scValToNative, xdr } from "@stellar/stellar-sdk";
import { CONTRACTS, NETWORK, PLATFORM_SCOPE } from "./config";
import { read, server } from "./stellar";
import { addIndexedLeaf, assertCredentialCount, assertCredentialLeaf, mergeCredentialLeaves, parseCredentialSnapshot, verifyCredentialLeaves } from "./credential-recovery";

export const TREE_DEPTH = 16;
export const FR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
/** ISO 3166-1 numeric codes the circuit rejects: US and sanctioned countries. */
export const BLOCKED_COUNTRIES = [840, 408, 364, 192, 760];



type Hasher = (inputs: bigint[]) => bigint;
let poseidon: Hasher | null = null;

async function getPoseidon(): Promise<Hasher> {
  if (!poseidon) {
    const { buildPoseidon } = await import("circomlibjs");
    const p = await buildPoseidon();
    poseidon = (inputs) => p.F.toObject(p(inputs)) as bigint;
  }
  return poseidon;
}

const bytesToBigInt = (bytes: Uint8Array) => bytes.reduce((x, b) => (x << 8n) | BigInt(b), 0n);
const frHex = (x: bigint) => x.toString(16).padStart(64, "0");

export function randomSecret() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return bytesToBigInt(b) % FR_MODULUS;
}

/** What the investor gives the issuer: Poseidon(secret). The secret itself stays here. */
export async function secretCommitment(secret: bigint) {
  return (await getPoseidon())([secret]);
}

/** The leaf the issuer adds: Poseidon(country, expiry, commitment), from the country it verified. */
export async function leafFromCommitment(country: number, expiry: number, commitment: bigint) {
  return (await getPoseidon())([BigInt(country), BigInt(expiry), commitment]);
}

export async function credentialLeaf(country: number, expiry: number, secret: bigint) {
  return leafFromCommitment(country, expiry, await secretCommitment(secret));
}

/** Same as the gate: Poseidon(hi, lo) of sha256(XDR(ScVal::Address)). */
export async function addressHash(strkey: string) {
  const d = new Uint8Array(sha256(new Address(strkey).toScVal().toXDR()));
  return (await getPoseidon())([bytesToBigInt(d.slice(0, 16)), bytesToBigInt(d.slice(16, 32))]);
}

/** Authentication path and root for `index` in the tree built from `leaves`. */
export async function merklePath(leaves: bigint[], index: number) {
  const H = await getPoseidon();
  const zeros = [0n];
  for (let i = 0; i < TREE_DEPTH; i++) zeros.push(H([zeros[i]!, zeros[i]!]));
  let level = leaves.slice();
  let idx = index;
  const path_elements: string[] = [];
  const path_indices: string[] = [];
  for (let i = 0; i < TREE_DEPTH; i++) {
    const sib = idx ^ 1;
    path_elements.push((sib < level.length ? level[sib]! : zeros[i]!).toString());
    path_indices.push(String(idx & 1));
    const next: bigint[] = [];
    for (let j = 0; j < level.length; j += 2) next.push(H([level[j]!, j + 1 < level.length ? level[j + 1]! : zeros[i]!]));
    level = next;
    idx >>= 1;
  }
  return { path_elements, path_indices, root: level[0] ?? zeros[TREE_DEPTH]! };
}

/** Indexed events in the RPC's actual retained window, including a late suffix. */
async function leavesFromEvents(): Promise<Map<number, bigint>> {
  const health = await server.getHealth();
  const startLedger = Math.max(NETWORK.gateFromLedger, health.oldestLedger);
  const byIndex = new Map<number, bigint>();
  if (startLedger > health.latestLedger) return byIndex;
  let cursor: string | undefined;
  const seen = new Set<string>();
  for (let page = 0; page < 1000; page++) {
    const filters = [{ type: "contract" as const, contractIds: [CONTRACTS.gate] }];
    const res = await server.getEvents(cursor
      ? { cursor, filters, limit: 200 }
      : { startLedger, filters, limit: 200 });
    for (const e of res.events) {
      const topics = e.topic.map((t) => scValToNative(t as xdr.ScVal));
      if (topics[0] === "gate" && topics[1] === "credential") {
        const value = scValToNative(e.value as xdr.ScVal) as { leaf: bigint };
        addIndexedLeaf(byIndex, Number(topics[2]), BigInt(value.leaf));
      }
    }
    if (res.events.length < 200) return byIndex;
    if (!res.cursor || seen.has(res.cursor)) throw new Error("Credential event pagination did not advance.");
    seen.add(res.cursor);
    cursor = res.cursor;
  }
  throw new Error("Credential event scan exceeded its page limit.");
}

/** Historical candidate from Horizon, which acts as an indexer on the current deployment. */
export async function leavesFromHistory(): Promise<bigint[]> {
  const admin = await read<string>(CONTRACTS.gate, "admin");
  const leaves: bigint[] = [];
  let url: string | null = `${NETWORK.horizonUrl}/accounts/${admin}/operations?order=asc&limit=200`;
  const seen = new Set<string>();
  for (let page = 0; url && page < 500; page++) {
    if (seen.has(url)) throw new Error("Credential history pagination did not advance.");
    seen.add(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Credential history request failed (${res.status}).`);
    const body = (await res.json()) as {
      _embedded?: { records: { type: string; transaction_successful?: boolean; parameters?: { value: string }[] }[] };
      _links?: { next?: { href: string } };
    };
    const records = body._embedded?.records;
    if (!Array.isArray(records)) throw new Error("Malformed credential history response.");
    for (const op of records) {
      if (op.type !== "invoke_host_function" || op.transaction_successful !== true || !op.parameters) continue;
      const [contract, fn, leaf] = op.parameters.slice(0, 3).map((p) => scValToNative(xdr.ScVal.fromXDR(p.value, "base64")));
      if (contract === CONTRACTS.gate && fn === "add_credential" && leaf !== undefined) {
        const parsed = BigInt(leaf as bigint);
        assertCredentialLeaf(parsed);
        leaves.push(parsed);
        assertCredentialCount(leaves.length);
      }
    }
    if (records.length < 200) return leaves;
    const next = body._links?.next?.href;
    if (!next) throw new Error("Credential history pagination is incomplete.");
    if (new URL(next).origin !== new URL(NETWORK.horizonUrl).origin) throw new Error("Unexpected credential history origin.");
    url = next;
  }
  if (url) throw new Error("Credential history scan exceeded its page limit.");
  return leaves;
}

const credentialRoot = async (leaves: bigint[]) => (await merklePath(leaves, 0)).root;

/** Optional versioned public snapshot, independent of admin-account history. */
async function leavesFromSnapshot(snapshot?: unknown): Promise<bigint[]> {
  let input = snapshot;
  if (input === undefined) {
    const url = process.env.NEXT_PUBLIC_CREDENTIAL_SNAPSHOT_URL || "/credential-snapshot.json";
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Credential snapshot request failed (${response.status}).`);
    input = await response.json();
  }
  const { leaves, root } = parseCredentialSnapshot(input, NETWORK.name, CONTRACTS.gate);
  return verifyCredentialLeaves(leaves, leaves.length, root, credentialRoot);
}

/** Reconstruct and authenticate every returned leaf against a stable on-chain root. */
export async function fetchLeaves(snapshot?: unknown): Promise<bigint[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const count = Number(await read<number>(CONTRACTS.gate, "next_index"));
    const expectedRoot = await read<bigint>(CONTRACTS.gate, "root");
    assertCredentialCount(count);
    assertCredentialLeaf(expectedRoot);
    const errors: string[] = [];
    const events = await leavesFromEvents().catch((e: unknown) => {
      errors.push(`RPC: ${String(e)}`);
      return new Map<number, bigint>();
    });
    const sources: [string, () => Promise<bigint[]>][] = [
      ["RPC events", async () => []],
      ["snapshot", () => leavesFromSnapshot(snapshot)],
      ["Horizon", leavesFromHistory],
    ];
    let verified: bigint[] | undefined;
    for (const [name, load] of sources) {
      try {
        const prefix = await load();
        try {
          verified = await verifyCredentialLeaves(mergeCredentialLeaves(prefix, events, count), count, expectedRoot, credentialRoot);
        } catch (error) {
          if (name === "RPC events" || prefix.length < count) throw error;
          verified = await verifyCredentialLeaves(prefix.slice(0, count), count, expectedRoot, credentialRoot);
        }
        break;
      } catch (e) {
        errors.push(`${name}: ${String(e)}`);
      }
    }
    const latestRoot = await read<bigint>(CONTRACTS.gate, "root");
    const latestCount = Number(await read<number>(CONTRACTS.gate, "next_index"));
    if (latestCount !== count || latestRoot !== expectedRoot) continue;
    if (verified) return verified;
    throw new Error(`Couldn't rebuild and verify the credential tree. ${errors.join("; ")}`);
  }
  throw new Error("The credential tree changed during reconstruction; please retry.");
}

/** Generate a public, root-validated snapshot for the configured testnet gate.
 * Pass the previous local snapshot (or null for bootstrap) to extend it without
 * relying on an HTTP server. No credentials, signatures or writes to chain.
 */
export async function buildCredentialSnapshot(previous: unknown) {
  if (NETWORK.name !== "testnet") throw new Error("Snapshot refresh is testnet only.");
  const leaves = await fetchLeaves(previous);
  return {
    version: 1,
    network: NETWORK.name,
    gate: CONTRACTS.gate,
    leaves: leaves.map(String),
    root: String(await credentialRoot(leaves)),
  };
}

/** A credential the investor keeps in this browser. Never sent anywhere. */
export type Credential = {
  country: number;
  expiry: number;
  secret: string;
  leaf: string;
  index?: number;
  /** The identity-check session it came from, deleted at the provider once the proof is on-chain. */
  kycSession?: string;
};

export type SorobanProof = {
  proof: { a: Uint8Array; b: Uint8Array; c: Uint8Array };
  root: bigint;
  now: number;
  nullifier: bigint;
  scope: bigint;
};

const hexBytes = (hex: string) => Uint8Array.from(hex.match(/../g)!.map((h) => parseInt(h, 16)));
const g1 = (p: string[]) => hexBytes(frHex(BigInt(p[0]!)) + frHex(BigInt(p[1]!)));
// Soroban wants G2 as x.c1 || x.c0 || y.c1 || y.c0; snarkjs gives [[c0, c1], [c0, c1]].
const g2 = (p: string[][]) =>
  hexBytes(frHex(BigInt(p[0]![1]!)) + frHex(BigInt(p[0]![0]!)) + frHex(BigInt(p[1]![1]!)) + frHex(BigInt(p[1]![0]!)));

/** Generates the Groth16 residence proof in the browser. Private inputs never leave it. */
export async function proveResidence(
  cred: Credential,
  address: string,
  leaves: bigint[],
  now: number,
  artifacts = { wasm: "/zk/residence.wasm", zkey: "/zk/residence_final.zkey" },
) {
  const index = cred.index ?? leaves.findIndex((l) => l === BigInt(cred.leaf));
  if (index < 0 || leaves[index] !== BigInt(cred.leaf)) throw new Error("Your credential isn't in the on-chain tree yet.");
  const H = await getPoseidon();
  const { path_elements, path_indices, root } = await merklePath(leaves, index);
  const nullifier = H([BigInt(cred.secret), PLATFORM_SCOPE]);
  const input = {
    root: root.toString(),
    now: String(now),
    nullifier: nullifier.toString(),
    address_hash: (await addressHash(address)).toString(),
    scope: PLATFORM_SCOPE.toString(),
    country_code: String(cred.country),
    expiry: String(cred.expiry),
    secret: cred.secret,
    path_elements,
    path_indices,
  };
  const snarkjs = await import("snarkjs");
  const { proof } = await snarkjs.groth16.fullProve(input, artifacts.wasm, artifacts.zkey);
  return {
    proof: { a: g1(proof.pi_a), b: g2(proof.pi_b), c: g1(proof.pi_c) },
    root,
    now,
    nullifier,
    scope: PLATFORM_SCOPE,
  } satisfies SorobanProof;
}
