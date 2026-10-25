#![cfg(test)]

use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

#[contract]
struct MockGate;

#[contractimpl]
impl MockGate {
    pub fn set(env: Env, investor: Address, ok: bool) {
        env.storage().persistent().set(&investor, &ok);
    }
    pub fn is_eligible(env: Env, investor: Address) -> bool {
        env.storage().persistent().get(&investor).unwrap_or(false)
    }
}

#[contract]
struct MockRegistry;

#[contractimpl]
impl MockRegistry {
    pub fn set(env: Env, id: u32, owner: Address) {
        env.storage().persistent().set(&id, &owner);
    }
    pub fn owner_if_active(env: Env, id: u32) -> Option<Address> {
        env.storage().persistent().get(&id)
    }
}

const USDC: i128 = 10_000_000;

struct Setup {
    env: Env,
    offering: OfferingClient<'static>,
    gate: MockGateClient<'static>,
    usdc: TokenClient<'static>,
    usdc_admin: StellarAssetClient<'static>,
    share: TokenClient<'static>,
    share_sac: StellarAssetClient<'static>,
    company: Address,
    treasury: Address,
    vault: Address,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);

    let admin = Address::generate(&env);
    let company = Address::generate(&env);
    let treasury = Address::generate(&env);
    let vault = Address::generate(&env);

    let gate_id = env.register(MockGate, ());
    let registry_id = env.register(MockRegistry, ());
    MockRegistryClient::new(&env, &registry_id).set(&1, &company);

    let usdc_sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let share_issuer = Address::generate(&env);
    let share = env.register_stellar_asset_contract_v2(share_issuer);
    share.issuer().set_flag(soroban_sdk::testutils::IssuerFlags::RequiredFlag);
    share.issuer().set_flag(soroban_sdk::testutils::IssuerFlags::RevocableFlag);

    let offering_id = env.register(
        Offering,
        (
            admin,
            gate_id.clone(),
            registry_id,
            vault.clone(),
            usdc_sac.address(),
            treasury.clone(),
            500u32,
        ),
    );
    let share_sac = StellarAssetClient::new(&env, &share.address());
    share_sac.set_admin(&offering_id);

    Setup {
        offering: OfferingClient::new(&env, &offering_id),
        gate: MockGateClient::new(&env, &gate_id),
        usdc: TokenClient::new(&env, &usdc_sac.address()),
        usdc_admin: StellarAssetClient::new(&env, &usdc_sac.address()),
        share: TokenClient::new(&env, &share.address()),
        share_sac,
        company,
        treasury,
        vault,
        env,
    }
}

fn investor(s: &Setup, usdc: i128) -> Address {
    let a = Address::generate(&s.env);
    s.gate.set(&a, &true);
    s.usdc_admin.mint(&a, &usdc);
    a
}

#[test]
fn successful_raise_pays_company_and_mints_tokens() {
    let s = setup();
    let id = s
        .offering
        .open_raise(&1, &s.share.address, &USDC, &(500 * USDC), &(1_000 * USDC), &2_000);
    assert!(s.share_sac.authorized(&s.vault));

    let a = investor(&s, 700 * USDC);
    let b = investor(&s, 300 * USDC);
    s.offering.invest(&id, &a, &(700 * USDC));
    s.offering.invest(&id, &b, &(300 * USDC));

    // Full, so it can close before the deadline.
    assert_eq!(s.offering.finalize(&id), RaiseState::Succeeded);
    assert_eq!(s.usdc.balance(&s.company), 950 * USDC);
    assert_eq!(s.usdc.balance(&s.treasury), 50 * USDC);

    assert_eq!(s.offering.claim_tokens(&id, &a), 700 * USDC);
    assert_eq!(s.offering.claim_tokens(&id, &b), 300 * USDC);
    assert_eq!(s.share.balance(&a), 700 * USDC);
    assert!(s.share_sac.authorized(&a));
    // Supply equals exactly what was sold.
    assert_eq!(s.share.balance(&a) + s.share.balance(&b), 1_000 * USDC);
    // Can't claim twice.
    assert!(s.offering.try_claim_tokens(&id, &a).is_err());
}

#[test]
fn failed_raise_refunds_in_full() {
    let s = setup();
    let id = s
        .offering
        .open_raise(&1, &s.share.address, &USDC, &(500 * USDC), &(1_000 * USDC), &2_000);
    let a = investor(&s, 200 * USDC);
    s.offering.invest(&id, &a, &(200 * USDC));

    assert!(s.offering.try_finalize(&id).is_err()); // not full, before deadline
    s.env.ledger().set_timestamp(2_000);
    assert_eq!(s.offering.finalize(&id), RaiseState::Failed);
    assert_eq!(s.offering.refund(&id, &a), 200 * USDC);
    assert_eq!(s.usdc.balance(&a), 200 * USDC);
    assert_eq!(s.usdc.balance(&s.company), 0);
    assert!(s.offering.try_claim_tokens(&id, &a).is_err());
}

#[test]
fn price_sets_token_amount() {
    let s = setup();
    // 2.5 USDC per token.
    let id = s
        .offering
        .open_raise(&1, &s.share.address, &(25 * USDC / 10), &(100 * USDC), &(100 * USDC), &2_000);
    let a = investor(&s, 100 * USDC);
    s.offering.invest(&id, &a, &(100 * USDC));
    s.offering.finalize(&id);
    assert_eq!(s.offering.claim_tokens(&id, &a), 40 * USDC);
}

#[test]
fn rejects_ineligible_investor_and_overflow() {
    let s = setup();
    let id = s
        .offering
        .open_raise(&1, &s.share.address, &USDC, &(10 * USDC), &(100 * USDC), &2_000);
    let outsider = Address::generate(&s.env);
    s.usdc_admin.mint(&outsider, &(50 * USDC));
    assert_eq!(
        s.offering.try_invest(&id, &outsider, &(50 * USDC)),
        Err(Ok(soroban_sdk::Error::from_contract_error(Error::NotEligible as u32)))
    );
    let a = investor(&s, 200 * USDC);
    assert_eq!(
        s.offering.try_invest(&id, &a, &(101 * USDC)),
        Err(Ok(soroban_sdk::Error::from_contract_error(Error::OverMax as u32)))
    );
}

#[test]
fn token_cannot_back_two_raises_and_needs_admin() {
    let s = setup();
    s.offering
        .open_raise(&1, &s.share.address, &USDC, &(10 * USDC), &(100 * USDC), &2_000);
    assert!(s
        .offering
        .try_open_raise(&1, &s.share.address, &USDC, &(10 * USDC), &(100 * USDC), &2_000)
        .is_err());

    let other = s.env.register_stellar_asset_contract_v2(Address::generate(&s.env));
    assert_eq!(
        s.offering.try_open_raise(&1, &other.address(), &USDC, &(10 * USDC), &(100 * USDC), &2_000),
        Err(Ok(soroban_sdk::Error::from_contract_error(Error::NotTokenAdmin as u32)))
    );
}

#[test]
fn secondary_holder_authorization() {
    let s = setup();
    let id = s
        .offering
        .open_raise(&1, &s.share.address, &USDC, &(10 * USDC), &(100 * USDC), &2_000);
    let buyer = investor(&s, 0);
    s.offering.authorize_holder(&id, &buyer);
    assert!(s.share_sac.authorized(&buyer));
    s.offering.revoke_holder(&id, &buyer);
    assert!(!s.share_sac.authorized(&buyer));

    let outsider = Address::generate(&s.env);
    assert!(s.offering.try_authorize_holder(&id, &outsider).is_err());
}
