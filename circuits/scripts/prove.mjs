#!/usr/bin/env node
// Generate a residence proof and its Soroban encodings.
//
// Library use:
//   import { proveResidence } from "./prove.mjs";
//   const out = await proveResidence({ country, expiry, secret,
//       path_elements, path_indices,          // or: leaves + leaf_index
//       now, scope, address, wasm, zkey });
//
// CLI use:
//   node scripts/prove.mjs input.json [out.json]
// where input.json has the same fields (numbers may be decimal strings).
// `wasm` / `zkey` default to build/residence.wasm and build/residence_final.zkey.
//
// Output:
//   { proof, publicSignals,            // raw snarkjs output
//     soroban: { proof: {a,b,c},       // hex: G1 64B, G2 128B (c1||c0), G1 64B
//                root, now, nullifier, scope, address_hash },  // decimal strings
//     hex: { root, nullifier, scope, address_hash } }          // 32-byte BE hex

import * as snarkjs from "snarkjs";
import {
  IncrementalTree,
  addressHash,
  computeNullifier,
  credentialLeaf,
  frToHex,
  proofToSoroban,
  PUBLIC_SIGNALS,
} from "./lib.mjs";

const DEFAULT_WASM = new URL("../build/residence.wasm", import.meta.url).pathname;
const DEFAULT_ZKEY = new URL("../build/residence_final.zkey", import.meta.url).pathname;

export async function proveResidence(args) {
  const { country, expiry, secret, now, scope, address } = args;
  const wasm = args.wasm ?? DEFAULT_WASM;
  const zkey = args.zkey ?? DEFAULT_ZKEY;

  const leaf = await credentialLeaf(country, expiry, secret);
  let { path_elements, path_indices, root } = args;
  if (!path_elements) {
    // Build the tree from the full leaf list (e.g. read from contract events).
    const tree = await IncrementalTree.create();
    for (const l of args.leaves) tree.insert(BigInt(l));
    const idx = args.leaf_index ?? tree.leaves.findIndex((l) => l === leaf);
    if (idx < 0) throw new Error("credential leaf not found in leaves");
    if (tree.leaves[idx] !== leaf) throw new Error("leaf_index does not hold this credential");
    ({ path_elements, path_indices } = tree.path(idx));
    root = tree.root();
  }
  if (root === undefined) {
    // recompute root from the path
    const tree = await IncrementalTree.create();
    let cur = leaf;
    for (let i = 0; i < path_elements.length; i++) {
      const sib = BigInt(path_elements[i]);
      cur = String(path_indices[i]) === "1" ? tree.H([sib, cur]) : tree.H([cur, sib]);
    }
    root = cur;
  }

  const nullifier = await computeNullifier(secret, scope);
  const address_hash = await addressHash(address);

  const input = {
    root: BigInt(root).toString(),
    now: BigInt(now).toString(),
    nullifier: nullifier.toString(),
    address_hash: address_hash.toString(),
    scope: BigInt(scope).toString(),
    country_code: BigInt(country).toString(),
    expiry: BigInt(expiry).toString(),
    secret: BigInt(secret).toString(),
    path_elements: path_elements.map(String),
    path_indices: path_indices.map(String),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey);

  // Sanity: public signal order must match what the contract builds.
  PUBLIC_SIGNALS.forEach((name, i) => {
    if (publicSignals[i] !== input[name]) {
      throw new Error(`public signal ${i} is not ${name}; circuit/contract order mismatch`);
    }
  });

  return {
    proof,
    publicSignals,
    input,
    soroban: {
      proof: proofToSoroban(proof),
      root: input.root,
      now: input.now,
      nullifier: input.nullifier,
      scope: input.scope,
      address_hash: input.address_hash,
    },
    hex: {
      root: frToHex(input.root),
      nullifier: frToHex(input.nullifier),
      scope: frToHex(input.scope),
      address_hash: frToHex(input.address_hash),
    },
  };
}

// ---- CLI ----
if (typeof process !== "undefined" && import.meta.url === `file://${process.argv?.[1]}`) {
  const { readFileSync, writeFileSync } = await import("node:fs");
  const [inFile, outFile] = process.argv.slice(2);
  if (!inFile) {
    console.error("usage: node scripts/prove.mjs input.json [out.json]");
    process.exit(1);
  }
  const out = await proveResidence(JSON.parse(readFileSync(inFile, "utf8")));
  const { input, ...rest } = out; // never write private inputs to the output
  const json = JSON.stringify(rest, null, 2);
  if (outFile) writeFileSync(outFile, json);
  else console.log(json);
  process.exit(0); // snarkjs keeps worker threads alive
}
