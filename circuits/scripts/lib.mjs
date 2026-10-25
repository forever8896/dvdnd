// Shared helpers for the residence circuit: Poseidon, the incremental Merkle
// tree (mirrors the gate contract), address hashing (mirrors the contract) and
// snarkjs -> Soroban byte encodings.
//
// Browser-safe: no `fs` / `path` imports here (the Next.js app can import it).

import { buildPoseidon } from "circomlibjs";
import { Address, hash as sha256 } from "@stellar/stellar-sdk";

export const TREE_DEPTH = 16;
// BN254 scalar field modulus r
export const FR_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
// ISO 3166-1 numeric codes rejected by the circuit
export const BLOCKED_COUNTRIES = [840, 408, 364, 192, 760];

let _poseidon;
/** Returns a function (bigint[]) -> bigint computing circomlib Poseidon. */
export async function getPoseidon() {
  if (!_poseidon) {
    const p = await buildPoseidon();
    _poseidon = (inputs) => p.F.toObject(p(inputs.map((x) => BigInt(x))));
  }
  return _poseidon;
}

/** Credential leaf = Poseidon(country_code, expiry, secret). */
export async function credentialLeaf(country, expiry, secret) {
  const H = await getPoseidon();
  return H([BigInt(country), BigInt(expiry), BigInt(secret)]);
}

/** nullifier = Poseidon(secret, scope). */
export async function computeNullifier(secret, scope) {
  const H = await getPoseidon();
  return H([BigInt(secret), BigInt(scope)]);
}

/** Random field element suitable as a credential secret. */
export function randomSecret() {
  const b = new Uint8Array(32);
  globalThis.crypto.getRandomValues(b);
  return bytesToBigInt(b) % FR_MODULUS;
}

/**
 * address_hash, computed identically in the gate contract:
 *   xdr   = XDR(ScVal::Address(addr))        (Address::to_xdr in Soroban)
 *   d     = sha256(xdr)                      (32 bytes)
 *   hi,lo = d[0..16], d[16..32] as big-endian 128-bit integers
 *   address_hash = Poseidon(hi, lo)
 */
export async function addressHash(strkey) {
  const xdr = new Address(strkey).toScVal().toXDR();
  const d = new Uint8Array(sha256(xdr));
  const hi = bytesToBigInt(d.slice(0, 16));
  const lo = bytesToBigInt(d.slice(16, 32));
  const H = await getPoseidon();
  return H([hi, lo]);
}

/**
 * Incremental Poseidon Merkle tree ("filled subtrees + zero hashes"), the same
 * construction the gate contract runs on-chain. Keeps all leaves so it can
 * produce authentication paths.
 */
export class IncrementalTree {
  constructor(H, depth = TREE_DEPTH) {
    this.H = H;
    this.depth = depth;
    this.zeros = [0n];
    for (let i = 0; i < depth; i++) this.zeros.push(H([this.zeros[i], this.zeros[i]]));
    this.leaves = [];
  }

  static async create(depth = TREE_DEPTH) {
    return new IncrementalTree(await getPoseidon(), depth);
  }

  insert(leaf) {
    this.leaves.push(BigInt(leaf));
    return this.leaves.length - 1;
  }

  // nodes at each level, levels[0] = leaves (sparse: missing nodes are zeros[i])
  _levels() {
    const levels = [this.leaves.slice()];
    for (let i = 0; i < this.depth; i++) {
      const cur = levels[i];
      const next = [];
      for (let j = 0; j < cur.length; j += 2) {
        const l = cur[j];
        const r = j + 1 < cur.length ? cur[j + 1] : this.zeros[i];
        next.push(this.H([l, r]));
      }
      levels.push(next);
    }
    return levels;
  }

  root() {
    if (this.leaves.length === 0) return this.zeros[this.depth];
    return this._levels()[this.depth][0];
  }

  /** Authentication path for leaf `index`: { path_elements, path_indices } (strings). */
  path(index) {
    if (index < 0 || index >= this.leaves.length) throw new Error("leaf index out of range");
    const levels = this._levels();
    const path_elements = [];
    const path_indices = [];
    let idx = index;
    for (let i = 0; i < this.depth; i++) {
      const sib = idx ^ 1;
      path_elements.push((sib < levels[i].length ? levels[i][sib] : this.zeros[i]).toString());
      path_indices.push(String(idx & 1));
      idx >>= 1;
    }
    return { path_elements, path_indices };
  }
}

// ---------------------------------------------------------------------------
// Encodings expected by the Soroban gate contract (all big-endian hex, no 0x)
// ---------------------------------------------------------------------------

export function bytesToBigInt(bytes) {
  let x = 0n;
  for (const b of bytes) x = (x << 8n) | BigInt(b);
  return x;
}

/** 32-byte big-endian hex of a field element / U256. */
export function frToHex(x) {
  const v = BigInt(x);
  if (v < 0n || v >= 1n << 256n) throw new Error("value out of range");
  return v.toString(16).padStart(64, "0");
}

/** G1 (snarkjs [x, y, "1"]) -> 64 bytes: be(x) || be(y). */
export function g1ToHex(p) {
  return frToHex(p[0]) + frToHex(p[1]);
}

/**
 * G2 (snarkjs [[x.c0, x.c1], [y.c0, y.c1], ["1","0"]]) -> 128 bytes:
 * be(x.c1) || be(x.c0) || be(y.c1) || be(y.c0)   (Ethereum / Soroban order:
 * imaginary part first, so the snarkjs pairs are swapped).
 */
export function g2ToHex(p) {
  return frToHex(p[0][1]) + frToHex(p[0][0]) + frToHex(p[1][1]) + frToHex(p[1][0]);
}

/** snarkjs proof -> gate `Proof { a, b, c }` (hex strings). */
export function proofToSoroban(proof) {
  return { a: g1ToHex(proof.pi_a), b: g2ToHex(proof.pi_b), c: g1ToHex(proof.pi_c) };
}

/** snarkjs verification_key.json -> gate `VerifyingKey { alpha, beta, gamma, delta, ic }`. */
export function vkToSoroban(vk) {
  if (vk.protocol !== "groth16" || vk.curve !== "bn128") throw new Error("expected groth16/bn128 vk");
  return {
    alpha: g1ToHex(vk.vk_alpha_1),
    beta: g2ToHex(vk.vk_beta_2),
    gamma: g2ToHex(vk.vk_gamma_2),
    delta: g2ToHex(vk.vk_delta_2),
    ic: vk.IC.map(g1ToHex),
  };
}

// Public signal order, as emitted by snarkjs for this circuit (no outputs,
// public inputs in declaration order). Checked against the contract in tests.
export const PUBLIC_SIGNALS = ["root", "now", "nullifier", "address_hash", "scope"];
