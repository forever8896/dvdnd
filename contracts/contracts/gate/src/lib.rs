#![no_std]
//! Gate: zero-knowledge residence eligibility for Reg S offerings.
//!
//! * The KYC issuer (admin) inserts credential commitments
//!   `Poseidon(country_code, expiry, secret)` into an on-chain incremental
//!   Poseidon Merkle tree (depth 16). The root is recomputed on-chain with the
//!   Poseidon host function, and the last `ROOT_HISTORY` roots are accepted.
//! * An investor proves in zero knowledge (Groth16 / BN254, circuit
//!   `circuits/residence.circom`) that they hold a credential in the tree whose
//!   country is not the US or sanctioned, that it has not expired, and that the
//!   proof is bound to their Stellar address. The contract verifies the proof
//!   with the BN254 pairing host function and marks the investor eligible.
//! * Other contracts call `is_eligible(investor)`.
//!
//! Public input order (must match snarkjs `public.json`):
//!   `[root, now, nullifier, address_hash, scope]`

use soroban_poseidon::PoseidonSponge;
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype,
    crypto::bn254::{Bn254Fr, Bn254G1Affine, Bn254G2Affine},
    panic_with_error, vec,
    xdr::ToXdr,
    Address, Env, Vec, U256,
};

/// Depth of the credential tree (65,536 leaves).
pub const TREE_DEPTH: u32 = 16;
/// Number of recent roots accepted by `verify_and_register`.
pub const ROOT_HISTORY: u32 = 30;
/// Allowed drift between the proof's `now` and the ledger timestamp (seconds).
pub const TIME_TOLERANCE: u64 = 600;
/// Nullifier scope for dvdnd. Pinned so each credential registers exactly one address.
const PLATFORM_SCOPE: u32 = 1;
/// How long a successful registration stays valid (seconds).
pub const ELIGIBILITY_PERIOD: u64 = 365 * 24 * 60 * 60;
/// Number of public inputs of the residence circuit.
pub const N_PUBLIC: u32 = 5;

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;
// Nullifier / eligibility entries. Archival is safe: an archived nullifier is
// never read as absent (it must be restored first), so a moderate TTL suffices.
const PERSISTENT_BUMP: u32 = 120 * DAY_IN_LEDGERS;
const PERSISTENT_THRESHOLD: u32 = PERSISTENT_BUMP - 7 * DAY_IN_LEDGERS;

/// BN254 scalar field modulus r (big-endian).
const FR_MODULUS_BE: [u8; 32] = [
    0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29, 0xb8, 0x50, 0x45, 0xb6, 0x81, 0x81, 0x58, 0x5d,
    0x28, 0x33, 0xe8, 0x48, 0x79, 0xb9, 0x70, 0x91, 0x43, 0xe1, 0xf5, 0x93, 0xf0, 0x00, 0x00, 0x01,
];

/// Groth16 verifying key. Encodings (big-endian, Ethereum/EIP-197 style):
/// G1 = x || y (64 bytes); G2 = x.c1 || x.c0 || y.c1 || y.c0 (128 bytes).
#[contracttype]
#[derive(Clone)]
pub struct VerifyingKey {
    pub alpha: Bn254G1Affine,
    pub beta: Bn254G2Affine,
    pub gamma: Bn254G2Affine,
    pub delta: Bn254G2Affine,
    /// `N_PUBLIC + 1` points.
    pub ic: Vec<Bn254G1Affine>,
}

/// Groth16 proof (snarkjs `pi_a`, `pi_b`, `pi_c`), same encodings as the key.
#[contracttype]
#[derive(Clone)]
pub struct Proof {
    pub a: Bn254G1Affine,
    pub b: Bn254G2Affine,
    pub c: Bn254G1Affine,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    MalformedVerifyingKey = 1,
    TreeFull = 2,
    UnknownRoot = 3,
    StaleTimestamp = 4,
    NullifierUsed = 5,
    InvalidProof = 6,
    /// A public input is not a canonical field element (>= r).
    NonCanonicalInput = 7,
    /// Leaf is not a canonical field element (>= r).
    InvalidLeaf = 8,
    /// Proofs must use the platform scope, so one credential maps to one address.
    WrongScope = 9,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Vk,
    /// Merkle tree state (`TreeState`).
    Tree,
    /// Ring buffer of recent roots (`Vec<U256>`, at most `ROOT_HISTORY`).
    Roots,
    /// Persistent: nullifier -> ().
    Nullifier(U256),
    /// Persistent: investor -> eligible-until timestamp.
    Eligible(Address),
}

#[contracttype]
#[derive(Clone)]
struct TreeState {
    next_index: u32,
    /// Index in `Roots` of the current root.
    root_index: u32,
    /// `zeros[i]` = root of an empty subtree of height i (len DEPTH + 1).
    zeros: Vec<U256>,
    /// Left-most filled node at each level (len DEPTH).
    filled: Vec<U256>,
    root: U256,
}

#[contractevent(topics = ["gate", "credential"])]
pub struct CredentialAdded {
    #[topic]
    pub index: u32,
    pub leaf: U256,
    pub root: U256,
}

#[contractevent(topics = ["gate", "registered"])]
pub struct Registered {
    #[topic]
    pub investor: Address,
    pub nullifier: U256,
    pub eligible_until: u64,
}

#[contractevent(topics = ["gate", "revoked"])]
pub struct Revoked {
    #[topic]
    pub investor: Address,
}

#[contract]
pub struct Gate;

#[contractimpl]
impl Gate {
    /// `admin` is the KYC issuer; `vk` the Groth16 key of the residence circuit.
    pub fn __constructor(env: Env, admin: Address, vk: VerifyingKey) {
        check_vk(&env, &vk);
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Vk, &vk);

        // zeros[0] = 0, zeros[i+1] = Poseidon(zeros[i], zeros[i])
        let mut sponge = PoseidonSponge::<3, Bn254Fr>::new(&env);
        let mut zeros = vec![&env, U256::from_u32(&env, 0)];
        for i in 0..TREE_DEPTH {
            let z = zeros.get_unchecked(i);
            zeros.push_back(sponge.compute_hash(&vec![&env, z.clone(), z]));
        }
        let mut filled = Vec::new(&env);
        for i in 0..TREE_DEPTH {
            filled.push_back(zeros.get_unchecked(i));
        }
        let root = zeros.get_unchecked(TREE_DEPTH);
        s.set(&DataKey::Roots, &vec![&env, root.clone()]);
        s.set(
            &DataKey::Tree,
            &TreeState { next_index: 0, root_index: 0, zeros, filled, root },
        );
    }

    // ---------------------------------------------------------------- admin

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        require_admin(&env);
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    /// Replace the verifying key (e.g. after a new trusted setup).
    pub fn set_vk(env: Env, vk: VerifyingKey) {
        require_admin(&env);
        check_vk(&env, &vk);
        env.storage().instance().set(&DataKey::Vk, &vk);
    }

    /// Insert a credential commitment into the tree; returns its leaf index.
    pub fn add_credential(env: Env, leaf: U256) -> u32 {
        require_admin(&env);
        if !is_canonical(&env, &leaf) {
            panic_with_error!(&env, Error::InvalidLeaf);
        }
        let s = env.storage().instance();
        let mut t: TreeState = s.get(&DataKey::Tree).unwrap();
        if t.next_index >= (1u32 << TREE_DEPTH) {
            panic_with_error!(&env, Error::TreeFull);
        }

        // Standard incremental-tree insertion: one Poseidon(2) per level,
        // computed with the Poseidon host function.
        let mut sponge = PoseidonSponge::<3, Bn254Fr>::new(&env);
        let index = t.next_index;
        let mut idx = index;
        let mut cur = leaf.clone();
        for i in 0..TREE_DEPTH {
            let (left, right) = if idx & 1 == 0 {
                t.filled.set(i, cur.clone());
                (cur, t.zeros.get_unchecked(i))
            } else {
                (t.filled.get_unchecked(i), cur)
            };
            cur = sponge.compute_hash(&vec![&env, left, right]);
            idx >>= 1;
        }

        // Push the new root into the ring buffer.
        let mut roots: Vec<U256> = s.get(&DataKey::Roots).unwrap();
        let slot = (t.root_index + 1) % ROOT_HISTORY;
        if slot < roots.len() {
            roots.set(slot, cur.clone());
        } else {
            roots.push_back(cur.clone());
        }
        t.root_index = slot;
        t.root = cur.clone();
        t.next_index = index + 1;
        s.set(&DataKey::Roots, &roots);
        s.set(&DataKey::Tree, &t);
        bump_instance(&env);

        CredentialAdded { index, leaf, root: cur }.publish(&env);
        index
    }

    /// Remove an investor's eligibility.
    pub fn revoke(env: Env, investor: Address) {
        require_admin(&env);
        env.storage().persistent().remove(&DataKey::Eligible(investor.clone()));
        Revoked { investor }.publish(&env);
    }

    // ---------------------------------------------------------------- views

    pub fn root(env: Env) -> U256 {
        tree(&env).root
    }

    pub fn next_index(env: Env) -> u32 {
        tree(&env).next_index
    }

    /// Whether `root` is one of the last `ROOT_HISTORY` roots.
    pub fn is_known_root(env: Env, root: U256) -> bool {
        let roots: Vec<U256> = env.storage().instance().get(&DataKey::Roots).unwrap();
        roots.contains(&root)
    }

    pub fn is_nullifier_used(env: Env, nullifier: U256) -> bool {
        env.storage().persistent().has(&DataKey::Nullifier(nullifier))
    }

    /// Timestamp until which `investor` is eligible (0 if never registered / revoked).
    pub fn eligible_until(env: Env, investor: Address) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::Eligible(investor))
            .unwrap_or(0)
    }

    /// Consumed by the offering contract (cross-contract call).
    pub fn is_eligible(env: Env, investor: Address) -> bool {
        Self::eligible_until(env.clone(), investor) > env.ledger().timestamp()
    }

    /// The Poseidon hash binding a proof to `investor` (see `address_hash`).
    pub fn address_hash(env: Env, investor: Address) -> U256 {
        address_hash(&env, &investor)
    }

    // ---------------------------------------------------------------- prove

    /// Verify a residence proof and register `investor` as eligible.
    /// Returns the eligible-until timestamp (`now + ELIGIBILITY_PERIOD`).
    pub fn verify_and_register(
        env: Env,
        investor: Address,
        proof: Proof,
        root: U256,
        now: u64,
        nullifier: U256,
        scope: U256,
    ) -> u64 {
        investor.require_auth();

        // Non-canonical values would be reduced mod r by Bn254Fr, letting the
        // same proof be replayed with `nullifier + r` etc.
        if !is_canonical(&env, &nullifier) || !is_canonical(&env, &scope) {
            panic_with_error!(&env, Error::NonCanonicalInput);
        }
        if scope != U256::from_u32(&env, PLATFORM_SCOPE) {
            panic_with_error!(&env, Error::WrongScope);
        }
        if !Self::is_known_root(env.clone(), root.clone()) {
            panic_with_error!(&env, Error::UnknownRoot);
        }
        let ts = env.ledger().timestamp();
        if now.abs_diff(ts) > TIME_TOLERANCE {
            panic_with_error!(&env, Error::StaleTimestamp);
        }
        let nkey = DataKey::Nullifier(nullifier.clone());
        if env.storage().persistent().has(&nkey) {
            panic_with_error!(&env, Error::NullifierUsed);
        }

        // Public inputs in snarkjs order: root, now, nullifier, address_hash, scope.
        let inputs = vec![
            &env,
            Bn254Fr::from_u256(root),
            Bn254Fr::from_u256(U256::from_u128(&env, now as u128)),
            Bn254Fr::from_u256(nullifier.clone()),
            Bn254Fr::from_u256(address_hash(&env, &investor)),
            Bn254Fr::from_u256(scope),
        ];
        let vk: VerifyingKey = env.storage().instance().get(&DataKey::Vk).unwrap();
        if !verify_groth16(&env, &vk, &proof, &inputs) {
            panic_with_error!(&env, Error::InvalidProof);
        }

        // Effects.
        let p = env.storage().persistent();
        p.set(&nkey, &());
        p.extend_ttl(&nkey, PERSISTENT_THRESHOLD, PERSISTENT_BUMP);
        let until = now + ELIGIBILITY_PERIOD;
        let ekey = DataKey::Eligible(investor.clone());
        p.set(&ekey, &until);
        p.extend_ttl(&ekey, PERSISTENT_THRESHOLD, PERSISTENT_BUMP);
        bump_instance(&env);

        Registered { investor, nullifier, eligible_until: until }.publish(&env);
        until
    }
}

// -------------------------------------------------------------------- helpers

fn require_admin(env: &Env) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
}

fn tree(env: &Env) -> TreeState {
    env.storage().instance().get(&DataKey::Tree).unwrap()
}

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

fn check_vk(env: &Env, vk: &VerifyingKey) {
    if vk.ic.len() != N_PUBLIC + 1 {
        panic_with_error!(env, Error::MalformedVerifyingKey);
    }
}

fn is_canonical(env: &Env, x: &U256) -> bool {
    *x < U256::from_be_bytes(env, &soroban_sdk::Bytes::from_array(env, &FR_MODULUS_BE))
}

/// address_hash = Poseidon(hi, lo) where hi || lo = sha256(XDR(ScVal::Address(addr)))
/// split into two big-endian 128-bit halves (each < r, so canonical).
/// Mirrored in `circuits/scripts/lib.mjs::addressHash`.
pub fn address_hash(env: &Env, addr: &Address) -> U256 {
    let digest = env.crypto().sha256(&addr.clone().to_xdr(env)).to_array();
    let mut hi = [0u8; 16];
    let mut lo = [0u8; 16];
    hi.copy_from_slice(&digest[..16]);
    lo.copy_from_slice(&digest[16..]);
    PoseidonSponge::<3, Bn254Fr>::new(env).compute_hash(&vec![
        env,
        U256::from_u128(env, u128::from_be_bytes(hi)),
        U256::from_u128(env, u128::from_be_bytes(lo)),
    ])
}

/// Groth16 check: e(-A, B) * e(alpha, beta) * e(vk_x, gamma) * e(C, delta) == 1
/// with vk_x = ic[0] + sum(inputs[i] * ic[i+1]) computed by one G1 MSM.
fn verify_groth16(env: &Env, vk: &VerifyingKey, proof: &Proof, inputs: &Vec<Bn254Fr>) -> bool {
    let bn = env.crypto().bn254();
    let mut points = Vec::new(env);
    for i in 1..vk.ic.len() {
        points.push_back(vk.ic.get_unchecked(i));
    }
    let vk_x = bn.g1_add(&vk.ic.get_unchecked(0), &bn.g1_msm(points, inputs.clone()));

    let g1 = vec![env, -proof.a.clone(), vk.alpha.clone(), vk_x, proof.c.clone()];
    let g2 = vec![
        env,
        proof.b.clone(),
        vk.beta.clone(),
        vk.gamma.clone(),
        vk.delta.clone(),
    ];
    bn.pairing_check(g1, g2)
}

#[cfg(test)]
mod fixtures;
#[cfg(test)]
mod test;
