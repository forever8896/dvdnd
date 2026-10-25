pragma circom 2.1.6;

// Residence eligibility proof (Reg S "not a US person").
//
// Proves, without revealing the investor's country, expiry or secret, that:
//   1. Poseidon(country_code, expiry, secret) is a leaf of the issuer's
//      Poseidon Merkle tree with the given (on-chain) root,
//   2. country_code is not the US (840) nor on a small sanctions list,
//   3. the credential has not expired (expiry > now),
//   4. nullifier == Poseidon(secret, scope)  (one registration per credential and scope),
//   5. the proof is bound to address_hash (the investor's Stellar address).

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/bitify.circom";

// Constrains `in` to differ from the constant `value`.
template NotEqualConst(value) {
    signal input in;
    component eq = IsEqual();
    eq.in[0] <== in;
    eq.in[1] <== value;
    eq.out === 0;
}

// Recomputes a Merkle root from a leaf and its authentication path.
// path_indices[i] = 0 if the current node is the left child at level i, 1 if right.
template MerkleRoot(depth) {
    signal input leaf;
    signal input path_elements[depth];
    signal input path_indices[depth];
    signal output root;

    component hashers[depth];
    signal cur[depth + 1];
    signal left[depth];
    signal right[depth];
    cur[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        // index bits must be boolean
        path_indices[i] * (1 - path_indices[i]) === 0;

        // swap (cur, sibling) when path_indices[i] == 1
        left[i] <== cur[i] + path_indices[i] * (path_elements[i] - cur[i]);
        right[i] <== path_elements[i] - path_indices[i] * (path_elements[i] - cur[i]);

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];
        cur[i + 1] <== hashers[i].out;
    }
    root <== cur[depth];
}

template Residence(depth) {
    // ---- public inputs (snarkjs orders public signals by declaration order) ----
    signal input root;
    signal input now;
    signal input nullifier;
    signal input address_hash;
    signal input scope;

    // ---- private inputs ----
    signal input country_code;
    signal input expiry;
    signal input secret;
    signal input path_elements[depth];
    signal input path_indices[depth];

    // 1. credential leaf is in the tree
    component leafHasher = Poseidon(3);
    leafHasher.inputs[0] <== country_code;
    leafHasher.inputs[1] <== expiry;
    leafHasher.inputs[2] <== secret;

    component tree = MerkleRoot(depth);
    tree.leaf <== leafHasher.out;
    for (var i = 0; i < depth; i++) {
        tree.path_elements[i] <== path_elements[i];
        tree.path_indices[i] <== path_indices[i];
    }
    tree.root === root;

    // 2. country is not US and not sanctioned (ISO 3166-1 numeric)
    var BLOCKED[5] = [840, 408, 364, 192, 760]; // US, North Korea, Iran, Cuba, Syria
    component notBlocked[5];
    for (var i = 0; i < 5; i++) {
        notBlocked[i] = NotEqualConst(BLOCKED[i]);
        notBlocked[i].in <== country_code;
    }

    // 3. expiry > now. Range-check both to 64 bits so LessThan(64) is sound.
    component expiryBits = Num2Bits(64);
    expiryBits.in <== expiry;
    component nowBits = Num2Bits(64);
    nowBits.in <== now;
    component notExpired = LessThan(64);
    notExpired.in[0] <== now;
    notExpired.in[1] <== expiry;
    notExpired.out === 1;

    // 4. nullifier = Poseidon(secret, scope)
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== scope;
    nullifierHasher.out === nullifier;

    // 5. bind address_hash to the proof (a public input with no constraint
    //    could be optimised away; a quadratic constraint keeps it in the R1CS)
    signal address_hash_sq;
    address_hash_sq <== address_hash * address_hash;
}

component main {public [root, now, nullifier, address_hash, scope]} = Residence(16);
