#![cfg(test)]
extern crate std;

use super::*;
use crate::fixtures::residence as fx;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Bytes, BytesN, Env,
};

// ------------------------------------------------------------------ helpers

fn hex<const N: usize>(s: &str) -> [u8; N] {
    assert_eq!(s.len(), 2 * N, "bad hex length");
    let mut out = [0u8; N];
    for i in 0..N {
        out[i] = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).unwrap();
    }
    out
}

fn u256(env: &Env, s: &str) -> U256 {
    U256::from_be_bytes(env, &Bytes::from_array(env, &hex::<32>(s)))
}

fn g1(env: &Env, s: &str) -> Bn254G1Affine {
    Bn254G1Affine::from_bytes(BytesN::from_array(env, &hex::<64>(s)))
}

fn g2(env: &Env, s: &str) -> Bn254G2Affine {
    Bn254G2Affine::from_bytes(BytesN::from_array(env, &hex::<128>(s)))
}

fn fixture_vk(env: &Env) -> VerifyingKey {
    let mut ic = Vec::new(env);
    for p in fx::VK_IC {
        ic.push_back(g1(env, p));
    }
    VerifyingKey {
        alpha: g1(env, fx::VK_ALPHA),
        beta: g2(env, fx::VK_BETA),
        gamma: g2(env, fx::VK_GAMMA),
        delta: g2(env, fx::VK_DELTA),
        ic,
    }
}

fn fixture_proof(env: &Env) -> Proof {
    Proof {
        a: g1(env, fx::PROOF_A),
        b: g2(env, fx::PROOF_B),
        c: g1(env, fx::PROOF_C),
    }
}

struct Setup<'a> {
    env: Env,
    client: GateClient<'a>,
    investor: Address,
}

/// Deploys the gate with the fixture VK, inserts the fixture leaves and sets
/// the ledger time to the proof's `now`.
fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.cost_estimate().disable_resource_limits();
    env.ledger().set_timestamp(fx::NOW);
    let admin = Address::generate(&env);
    let id = env.register(Gate, (admin, fixture_vk(&env)));
    let client = GateClient::new(&env, &id);
    for leaf in fx::LEAVES {
        client.add_credential(&u256(&env, leaf));
    }
    let investor = Address::from_str(&env, fx::INVESTOR);
    Setup { env, client, investor }
}

fn register(s: &Setup) -> Result<u64, ()> {
    let e = &s.env;
    match s.client.try_verify_and_register(
        &s.investor,
        &fixture_proof(e),
        &u256(e, fx::ROOT),
        &fx::NOW,
        &u256(e, fx::NULLIFIER),
        &u256(e, fx::SCOPE),
    ) {
        Ok(Ok(v)) => Ok(v),
        _ => Err(()),
    }
}

fn assert_err<T: core::fmt::Debug, E: core::fmt::Debug>(
    r: Result<Result<T, E>, Result<soroban_sdk::Error, soroban_sdk::InvokeError>>,
    expected: Error,
) {
    match r {
        Err(Ok(e)) => assert_eq!(e, soroban_sdk::Error::from_contract_error(expected as u32)),
        other => panic!("expected {:?}, got {:?}", expected, other),
    }
}

// --------------------------------------------------------- Poseidon parity

#[test]
fn poseidon_matches_circomlibjs() {
    let env = Env::default();
    let h = PoseidonSponge::<3, Bn254Fr>::new(&env).compute_hash(&soroban_sdk::vec![
        &env,
        U256::from_u32(&env, 1),
        U256::from_u32(&env, 2)
    ]);
    assert_eq!(h, u256(&env, fx::POSEIDON_1_2));
}

#[test]
fn onchain_merkle_root_matches_js() {
    let env = Env::default();
    env.mock_all_auths();
    env.cost_estimate().disable_resource_limits();
    let id = env.register(Gate, (Address::generate(&env), fixture_vk(&env)));
    let client = GateClient::new(&env, &id);

    // Empty tree root = zeros[16].
    assert_eq!(client.root(), u256(&env, fx::EMPTY_ROOT));
    assert_eq!(client.next_index(), 0);

    for (i, leaf) in fx::LEAVES.iter().enumerate() {
        let idx = client.add_credential(&u256(&env, leaf));
        assert_eq!(idx, i as u32);
        // Root recomputed on-chain with the Poseidon host function equals
        // the root computed off-chain by circomlibjs.
        assert_eq!(client.root(), u256(&env, fx::ROOTS_AFTER[i]));
    }
    assert_eq!(client.next_index(), fx::LEAVES.len() as u32);
    assert_eq!(client.root(), u256(&env, fx::ROOT));
    // Old roots remain valid.
    assert!(client.is_known_root(&u256(&env, fx::ROOTS_AFTER[0])));
    assert!(client.is_known_root(&u256(&env, fx::EMPTY_ROOT)));
}

#[test]
fn address_hash_matches_js() {
    let s = setup();
    assert_eq!(
        s.client.address_hash(&s.investor),
        u256(&s.env, fx::ADDRESS_HASH)
    );
}

// --------------------------------------------------------------- happy path

#[test]
fn real_snarkjs_proof_verifies_and_registers() {
    let s = setup();
    assert!(!s.client.is_eligible(&s.investor));

    let until = register(&s).expect("valid proof must verify");
    assert_eq!(until, fx::NOW + ELIGIBILITY_PERIOD);

    let res = s.env.cost_estimate().resources();
    std::println!(
        "verify_and_register (native test contract): {} CPU instructions, {} bytes mem",
        res.instructions, res.mem_bytes
    );

    assert!(s.client.is_eligible(&s.investor));
    assert_eq!(s.client.eligible_until(&s.investor), until);
    assert!(s.client.is_nullifier_used(&u256(&s.env, fx::NULLIFIER)));

    // Expires after the eligibility period.
    s.env.ledger().set_timestamp(until);
    assert!(!s.client.is_eligible(&s.investor));
}

#[test]
fn revoke_removes_eligibility() {
    let s = setup();
    register(&s).unwrap();
    s.client.revoke(&s.investor);
    assert!(!s.client.is_eligible(&s.investor));
}

#[test]
fn proof_still_valid_against_recent_root() {
    let s = setup();
    // More credentials are issued after the proof was generated.
    for i in 0..5u32 {
        s.client.add_credential(&U256::from_u32(&s.env, 1000 + i));
    }
    assert_ne!(s.client.root(), u256(&s.env, fx::ROOT));
    register(&s).expect("proof against a recent root must verify");
}

#[test]
fn now_within_tolerance() {
    let s = setup();
    s.env.ledger().set_timestamp(fx::NOW + TIME_TOLERANCE);
    register(&s).expect("within tolerance");
}

// ----------------------------------------------------------- negative tests

#[test]
fn tampered_proof_fails() {
    let s = setup();
    let e = &s.env;
    // Swap A and C (both valid curve points, wrong proof).
    let mut proof = fixture_proof(e);
    core::mem::swap(&mut proof.a, &mut proof.c);
    let r = s.client.try_verify_and_register(
        &s.investor,
        &proof,
        &u256(e, fx::ROOT),
        &fx::NOW,
        &u256(e, fx::NULLIFIER),
        &u256(e, fx::SCOPE),
    );
    assert_err(r, Error::InvalidProof);

    // Negate A: still on-curve, pairing fails.
    let mut proof = fixture_proof(e);
    proof.a = -proof.a;
    let r = s.client.try_verify_and_register(
        &s.investor,
        &proof,
        &u256(e, fx::ROOT),
        &fx::NOW,
        &u256(e, fx::NULLIFIER),
        &u256(e, fx::SCOPE),
    );
    assert_err(r, Error::InvalidProof);
    assert!(!s.client.is_eligible(&s.investor));
}

#[test]
fn wrong_public_inputs_fail() {
    let s = setup();
    let e = &s.env;
    let call = |now: u64, nullifier: U256, scope: U256| {
        s.client.try_verify_and_register(
            &s.investor,
            &fixture_proof(e),
            &u256(e, fx::ROOT),
            &now,
            &nullifier,
            &scope,
        )
    };
    let nul = u256(e, fx::NULLIFIER);
    let scope = u256(e, fx::SCOPE);
    assert_err(call(fx::NOW + 1, nul.clone(), scope.clone()), Error::InvalidProof);
    assert_err(call(fx::NOW, U256::from_u32(e, 7), scope.clone()), Error::InvalidProof);
    assert_err(call(fx::NOW, nul.clone(), U256::from_u32(e, 2)), Error::WrongScope);
}

#[test]
fn proof_bound_to_investor_address() {
    let s = setup();
    let e = &s.env;
    // Someone else submits the investor's proof for their own address.
    let thief = Address::generate(e);
    let r = s.client.try_verify_and_register(
        &thief,
        &fixture_proof(e),
        &u256(e, fx::ROOT),
        &fx::NOW,
        &u256(e, fx::NULLIFIER),
        &u256(e, fx::SCOPE),
    );
    assert_err(r, Error::InvalidProof);
    assert!(!s.client.is_eligible(&thief));
}

#[test]
fn reused_nullifier_fails() {
    let s = setup();
    register(&s).unwrap();
    let e = &s.env;
    let r = s.client.try_verify_and_register(
        &s.investor,
        &fixture_proof(e),
        &u256(e, fx::ROOT),
        &fx::NOW,
        &u256(e, fx::NULLIFIER),
        &u256(e, fx::SCOPE),
    );
    assert_err(r, Error::NullifierUsed);
}

#[test]
fn non_canonical_nullifier_rejected() {
    // nullifier + r would reduce to the same field element; must be rejected.
    let s = setup();
    let e = &s.env;
    let r_mod = U256::from_be_bytes(e, &Bytes::from_array(e, &FR_MODULUS_BE));
    let r = s.client.try_verify_and_register(
        &s.investor,
        &fixture_proof(e),
        &u256(e, fx::ROOT),
        &fx::NOW,
        &u256(e, fx::NULLIFIER).add(&r_mod),
        &u256(e, fx::SCOPE),
    );
    assert_err(r, Error::NonCanonicalInput);
}

#[test]
fn wrong_root_fails() {
    let s = setup();
    let e = &s.env;
    let r = s.client.try_verify_and_register(
        &s.investor,
        &fixture_proof(e),
        &U256::from_u32(e, 12345),
        &fx::NOW,
        &u256(e, fx::NULLIFIER),
        &u256(e, fx::SCOPE),
    );
    assert_err(r, Error::UnknownRoot);
}

#[test]
fn root_falls_out_of_history() {
    let s = setup();
    for i in 0..ROOT_HISTORY {
        s.client.add_credential(&U256::from_u32(&s.env, 5000 + i));
    }
    assert!(!s.client.is_known_root(&u256(&s.env, fx::ROOT)));
    assert!(register(&s).is_err());
}

#[test]
fn stale_timestamp_fails() {
    let s = setup();
    s.env.ledger().set_timestamp(fx::NOW + TIME_TOLERANCE + 1);
    let e = &s.env;
    let r = s.client.try_verify_and_register(
        &s.investor,
        &fixture_proof(e),
        &u256(e, fx::ROOT),
        &fx::NOW,
        &u256(e, fx::NULLIFIER),
        &u256(e, fx::SCOPE),
    );
    assert_err(r, Error::StaleTimestamp);
}

#[test]
fn admin_only_functions_require_admin_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let id = env.register(Gate, (admin.clone(), fixture_vk(&env)));
    let client = GateClient::new(&env, &id);
    // No auth mocked: admin calls must fail.
    assert!(client.try_add_credential(&U256::from_u32(&env, 1)).is_err());
    assert!(client.try_revoke(&Address::generate(&env)).is_err());
    assert!(client.try_set_vk(&fixture_vk(&env)).is_err());
}

#[test]
fn malformed_vk_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(Gate, (Address::generate(&env), fixture_vk(&env)));
    let client = GateClient::new(&env, &id);
    let mut vk = fixture_vk(&env);
    vk.ic.pop_back();
    assert_err(client.try_set_vk(&vk), Error::MalformedVerifyingKey);
}

/// Cost measurement against the real optimized WASM (includes VM costs).
/// Run after `stellar contract build --package gate`:
///   cargo test -p gate wasm_cost -- --ignored --nocapture
#[test]
#[ignore]
fn wasm_cost() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../target/wasm32v1-none/release/gate.wasm");
    let wasm = std::fs::read(&path).expect("build the wasm first");
    let env = Env::default();
    env.mock_all_auths();
    env.cost_estimate().disable_resource_limits();
    env.ledger().set_timestamp(fx::NOW);
    let id = env.register(wasm.as_slice(), (Address::generate(&env), fixture_vk(&env)));
    let client = GateClient::new(&env, &id);
    for leaf in fx::LEAVES {
        client.add_credential(&u256(&env, leaf));
    }
    let r = env.cost_estimate().resources();
    std::println!("add_credential (wasm): {} CPU instructions", r.instructions);
    let investor = Address::from_str(&env, fx::INVESTOR);
    client.verify_and_register(
        &investor,
        &fixture_proof(&env),
        &u256(&env, fx::ROOT),
        &fx::NOW,
        &u256(&env, fx::NULLIFIER),
        &u256(&env, fx::SCOPE),
    );
    let r = env.cost_estimate().resources();
    std::println!(
        "verify_and_register (wasm): {} CPU instructions, {} mem bytes; fee estimate {:?}",
        r.instructions,
        r.mem_bytes,
        env.cost_estimate().fee()
    );
    assert!(client.is_eligible(&investor));
}
