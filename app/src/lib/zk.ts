// Browser side of the residence proof. Mirrors circuits/scripts/lib.mjs and
// the gate contract: Poseidon credential leaves, the incremental Merkle tree,
// address hashing and the Soroban byte encodings. The leaf commits to
// Poseidon(secret), so the issuer builds it without seeing the secret.

import { Address, hash as sha256, scValToNative, xdr } from "@stellar/stellar-sdk";
import { CONTRACTS, IS_TESTNET, NETWORK, PLATFORM_SCOPE } from "./config";
import { server } from "./stellar";

export const TREE_DEPTH = 16;
export const FR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
/** ISO 3166-1 numeric codes the circuit rejects: US and sanctioned countries. */
export const BLOCKED_COUNTRIES = [840, 408, 364, 192, 760];



/** Leaves added by the testnet scripts (deployments/leaves.txt), in case their
 *  events have aged out of the RPC's retention window. */
const SEED_LEAVES = !IS_TESTNET ? [] : [
  2920813559804466193731226775655382869245818185320923264349000061924371847621n,
  1805349285631615644189923436174968803622949138974697833619066379894756603756n,
  1499241073423087378472867032534468444348954377796449146218886510146892296430n,
  3870723909550316124661668125930901585586464390898142280372167990308355596900n,
];

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

/** All credential leaves, by index, from the gate's `credential` events. */
export async function fetchLeaves(): Promise<bigint[]> {
  const latest = await server.getLatestLedger();
  // RPC keeps about a week of events; start no earlier than it allows.
  const retentionFloor = latest.sequence - 120_000;
  let startLedger = Math.max(NETWORK.gateFromLedger, retentionFloor);
  const byIndex = new Map<number, bigint>(SEED_LEAVES.map((l, i) => [i, l]));
  let cursor: string | undefined;
  for (let page = 0; page < 50; page++) {
    const res = await server.getEvents(
      cursor
        ? { cursor, filters: [{ type: "contract", contractIds: [CONTRACTS.gate] }], limit: 200 }
        : { startLedger, filters: [{ type: "contract", contractIds: [CONTRACTS.gate] }], limit: 200 },
    );
    for (const e of res.events) {
      const topics = e.topic.map((t) => scValToNative(t as xdr.ScVal));
      if (topics[0] === "gate" && topics[1] === "credential") {
        const value = scValToNative(e.value as xdr.ScVal) as { leaf: bigint };
        byIndex.set(Number(topics[2]), BigInt(value.leaf));
      }
    }
    if (res.events.length < 200) break;
    cursor = res.cursor;
    startLedger = 0;
  }
  const leaves: bigint[] = [];
  for (let i = 0; byIndex.has(i); i++) leaves.push(byIndex.get(i)!);
  return leaves;
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
