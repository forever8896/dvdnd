#![cfg(test)]

use super::*;
use soroban_sdk::BytesN;
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

/// Minimal lock vault: takes the holder's tokens with their authorization.
#[contract]
struct MockVault;

#[contractimpl]
impl MockVault {
    pub fn lock(env: Env, token: Address, holder: Address, amount: i128) {
        holder.require_auth();
        TokenClient::new(&env, &token).transfer(&holder, &env.current_contract_address(), &amount);
        let key = (token, holder);
        let prev: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(prev + amount));
    }
    pub fn locked(env: Env, token: Address, holder: Address) -> i128 {
        env.storage().persistent().get(&(token, holder)).unwrap_or(0)
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
const FEE: i128 = 250 * USDC;
const DEADLINE: u64 = 2_000;
const YEAR: u64 = 365 * 24 * 60 * 60;

struct Setup {
    env: Env,
    offering: OfferingClient<'static>,
    gate: MockGateClient<'static>,
    vault: MockVaultClient<'static>,
    usdc: TokenClient<'static>,
    usdc_admin: StellarAssetClient<'static>,
    share: TokenClient<'static>,
    share_sac: StellarAssetClient<'static>,
    company: Address,
    treasury: Address,
    compliance: Address,
    verifier: Address,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);

    let admin = Address::generate(&env);
    let compliance = Address::generate(&env);
    let verifier = Address::generate(&env);
    let company = Address::generate(&env);
    let treasury = Address::generate(&env);

    let gate_id = env.register(MockGate, ());
    let vault_id = env.register(MockVault, ());
    let registry_id = env.register(MockRegistry, ());
    MockRegistryClient::new(&env, &registry_id).set(&1, &company);

    let usdc_sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let share_issuer = Address::generate(&env);
    let share = env.register_stellar_asset_contract_v2(share_issuer);
    share.issuer().set_flag(soroban_sdk::testutils::IssuerFlags::RequiredFlag);
    share.issuer().set_flag(soroban_sdk::testutils::IssuerFlags::RevocableFlag);
    share.issuer().set_flag(soroban_sdk::testutils::IssuerFlags::ClawbackEnabledFlag);

    let offering_id = env.register(
        Offering,
        (admin, gate_id.clone(), registry_id, vault_id.clone(), usdc_sac.address(), treasury.clone(), FEE),
    );
    let share_sac = StellarAssetClient::new(&env, &share.address());
    share_sac.set_admin(&offering_id);
    let usdc_admin = StellarAssetClient::new(&env, &usdc_sac.address());
    usdc_admin.mint(&company, &(10 * FEE));

    Setup {
        offering: OfferingClient::new(&env, &offering_id),
        gate: MockGateClient::new(&env, &gate_id),
        vault: MockVaultClient::new(&env, &vault_id),
        usdc: TokenClient::new(&env, &usdc_sac.address()),
        usdc_admin,
        share: TokenClient::new(&env, &share.address()),
        share_sac,
        company,
        treasury,
        compliance,
        verifier,
        env,
    }
}

/// Reg S terms with no minimum, 100 holders and lock-up ending at the deadline.
fn reg_s(s: &Setup) -> Terms {
    Terms {
        exemption: Exemption::RegS,
        min_ticket: 0,
        max_holders: 100,
        lockup_until: DEADLINE,
        compliance: s.compliance.clone(),
        verifier: None,
    }
}

fn reg_d(s: &Setup) -> Terms {
    Terms {
        exemption: Exemption::RegD506c,
        min_ticket: 0,
        max_holders: 100,
        lockup_until: DEADLINE + YEAR,
        compliance: s.compliance.clone(),
        verifier: Some(s.verifier.clone()),
    }
}

fn open(s: &Setup, min: i128, max: i128, terms: &Terms) -> u32 {
    s.offering.open_raise(&1, &s.share.address, &USDC, &min, &max, &DEADLINE, terms)
}

fn investor(s: &Setup, usdc: i128) -> Address {
    let a = Address::generate(&s.env);
    s.gate.set(&a, &true);
    s.usdc_admin.mint(&a, &usdc);
    a
}

fn err(e: Error) -> Result<soroban_sdk::Error, soroban_sdk::InvokeError> {
    Ok(soroban_sdk::Error::from_contract_error(e as u32))
}

#[test]
fn flat_fee_at_open_and_company_gets_everything_raised() {
    let s = setup();
    let id = open(&s, 500 * USDC, 1_000 * USDC, &reg_s(&s));
    assert_eq!(s.usdc.balance(&s.treasury), FEE);
    assert_eq!(s.offering.raise(&id).fee_paid, FEE);
    assert!(s.share_sac.authorized(&s.vault.address));

    let a = investor(&s, 700 * USDC);
    let b = investor(&s, 300 * USDC);
    s.offering.invest(&id, &a, &(700 * USDC));
    s.offering.invest(&id, &b, &(300 * USDC));

    // Full, so it can close before the deadline. No cut of the raise.
    let before = s.usdc.balance(&s.company);
    assert_eq!(s.offering.finalize(&id), RaiseState::Succeeded);
    assert_eq!(s.usdc.balance(&s.company) - before, 1_000 * USDC);
    assert_eq!(s.usdc.balance(&s.treasury), FEE);

    // Lock-up has passed (it ends at the deadline), so tokens go to the wallet.
    s.env.ledger().set_timestamp(DEADLINE);
    assert_eq!(s.offering.claim_tokens(&id, &a), 700 * USDC);
    assert_eq!(s.offering.claim_tokens(&id, &b), 300 * USDC);
    assert_eq!(s.share.balance(&a), 700 * USDC);
    assert!(s.share_sac.authorized(&a));
    assert_eq!(s.share.balance(&a) + s.share.balance(&b), 1_000 * USDC);
    assert!(s.offering.try_claim_tokens(&id, &a).is_err());
}

#[test]
fn failed_raise_refunds_in_full() {
    let s = setup();
    let id = open(&s, 500 * USDC, 1_000 * USDC, &reg_s(&s));
    let a = investor(&s, 200 * USDC);
    s.offering.invest(&id, &a, &(200 * USDC));

    assert_eq!(s.offering.try_finalize(&id), Err(err(Error::TooEarly)));
    s.env.ledger().set_timestamp(DEADLINE);
    assert_eq!(s.offering.finalize(&id), RaiseState::Failed);
    assert_eq!(s.offering.refund(&id, &a), 200 * USDC);
    assert_eq!(s.usdc.balance(&a), 200 * USDC);
    assert!(s.offering.try_claim_tokens(&id, &a).is_err());
}

#[test]
fn price_sets_token_amount() {
    let s = setup();
    // 2.5 USDC per token.
    let id = s.offering.open_raise(&1, &s.share.address, &(25 * USDC / 10), &(100 * USDC), &(100 * USDC), &DEADLINE, &reg_s(&s));
    let a = investor(&s, 100 * USDC);
    s.offering.invest(&id, &a, &(100 * USDC));
    s.offering.finalize(&id);
    s.env.ledger().set_timestamp(DEADLINE);
    assert_eq!(s.offering.claim_tokens(&id, &a), 40 * USDC);
}

#[test]
fn rejects_ineligible_overflow_and_small_tickets() {
    let s = setup();
    let mut terms = reg_s(&s);
    terms.min_ticket = 20 * USDC;
    let id = open(&s, 10 * USDC, 100 * USDC, &terms);
    let outsider = Address::generate(&s.env);
    s.usdc_admin.mint(&outsider, &(50 * USDC));
    assert_eq!(s.offering.try_invest(&id, &outsider, &(50 * USDC)), Err(err(Error::NotEligible)));
    let a = investor(&s, 200 * USDC);
    assert_eq!(s.offering.try_invest(&id, &a, &(101 * USDC)), Err(err(Error::OverMax)));
    assert_eq!(s.offering.try_invest(&id, &a, &(19 * USDC)), Err(err(Error::BelowMinimum)));
    // The minimum is on the investor's total, so a top-up below it is fine.
    s.offering.invest(&id, &a, &(20 * USDC));
    s.offering.invest(&id, &a, &(5 * USDC));
    assert_eq!(s.offering.contribution(&id, &a), 25 * USDC);
}

#[test]
fn invalid_terms_are_refused() {
    let s = setup();
    let mut t = reg_s(&s);
    t.max_holders = 0;
    assert_eq!(s.offering.try_open_raise(&1, &s.share.address, &USDC, &USDC, &(10 * USDC), &DEADLINE, &t), Err(err(Error::InvalidTerms)));
    t.max_holders = MAX_HOLDERS + 1;
    assert_eq!(s.offering.try_open_raise(&1, &s.share.address, &USDC, &USDC, &(10 * USDC), &DEADLINE, &t), Err(err(Error::InvalidTerms)));
    // Reg D needs a lock-up of at least a year after the deadline.
    let mut d = reg_d(&s);
    d.lockup_until = DEADLINE + YEAR - 1;
    assert_eq!(s.offering.try_open_raise(&1, &s.share.address, &USDC, &USDC, &(10 * USDC), &DEADLINE, &d), Err(err(Error::InvalidTerms)));
}

#[test]
fn token_cannot_back_two_raises_and_needs_admin() {
    let s = setup();
    open(&s, 10 * USDC, 100 * USDC, &reg_s(&s));
    assert_eq!(
        s.offering.try_open_raise(&1, &s.share.address, &USDC, &(10 * USDC), &(100 * USDC), &DEADLINE, &reg_s(&s)),
        Err(err(Error::TokenInUse))
    );
    let other = s.env.register_stellar_asset_contract_v2(Address::generate(&s.env));
    assert_eq!(
        s.offering.try_open_raise(&1, &other.address(), &USDC, &(10 * USDC), &(100 * USDC), &DEADLINE, &reg_s(&s)),
        Err(err(Error::NotTokenAdmin))
    );
}

#[test]
fn lockup_keeps_tokens_in_the_vault_until_release() {
    let s = setup();
    let mut terms = reg_s(&s);
    terms.lockup_until = DEADLINE + 1_000;
    let id = open(&s, 10 * USDC, 100 * USDC, &terms);
    let a = investor(&s, 100 * USDC);
    s.offering.invest(&id, &a, &(100 * USDC));
    s.offering.finalize(&id);

    // Claimed during lock-up: straight into the vault, wallet frozen.
    assert_eq!(s.offering.claim_tokens(&id, &a), 100 * USDC);
    assert_eq!(s.vault.locked(&s.share.address, &a), 100 * USDC);
    assert_eq!(s.share.balance(&a), 0);
    assert!(!s.share_sac.authorized(&a));

    // No new holders and no release before the date.
    let buyer = investor(&s, 0);
    assert_eq!(s.offering.try_authorize_holder(&id, &buyer), Err(err(Error::LockedUp)));
    assert_eq!(s.offering.try_release(&id, &a), Err(err(Error::LockedUp)));
    let reason = soroban_sdk::String::from_str(&s.env, "Lock-up");
    assert_eq!(s.offering.try_unfreeze_holder(&id, &a, &reason), Err(err(Error::LockedUp)));

    s.env.ledger().set_timestamp(DEADLINE + 1_000);
    s.offering.release(&id, &a);
    assert!(s.share_sac.authorized(&a));
    assert_eq!(s.offering.try_release(&id, &a), Err(err(Error::NothingToClaim)));
    s.offering.authorize_holder(&id, &buyer);
    assert!(s.share_sac.authorized(&buyer));
}

#[test]
fn compliance_freeze_outlasts_lockup() {
    let s = setup();
    let mut terms = reg_s(&s);
    terms.lockup_until = DEADLINE + 1_000;
    let id = open(&s, 10 * USDC, 100 * USDC, &terms);
    let a = investor(&s, 100 * USDC);
    s.offering.invest(&id, &a, &(100 * USDC));
    s.offering.finalize(&id);
    s.offering.claim_tokens(&id, &a);

    s.offering.freeze_holder(&id, &a, &soroban_sdk::String::from_str(&s.env, "Court order 2026/114"));
    assert_eq!(s.env.auths()[0].0, s.compliance);
    s.env.ledger().set_timestamp(DEADLINE + 1_000);
    assert_eq!(s.offering.try_release(&id, &a), Err(err(Error::NothingToClaim)));
    assert!(!s.share_sac.authorized(&a));
    s.offering.unfreeze_holder(&id, &a, &soroban_sdk::String::from_str(&s.env, "Order lifted"));
    assert!(s.share_sac.authorized(&a));
}

#[test]
fn reg_s_secondary_holders_need_the_gate() {
    let s = setup();
    let id = open(&s, 10 * USDC, 100 * USDC, &reg_s(&s));
    s.env.ledger().set_timestamp(DEADLINE);
    let buyer = investor(&s, 0);
    s.offering.authorize_holder(&id, &buyer);
    assert!(s.share_sac.authorized(&buyer));
    let outsider = Address::generate(&s.env);
    assert_eq!(s.offering.try_authorize_holder(&id, &outsider), Err(err(Error::NotEligible)));
}

#[test]
fn reg_d_self_certified_needs_the_high_minimum() {
    let s = setup();
    let mut terms = reg_d(&s);
    terms.verifier = None;
    let id = open(&s, 10 * USDC, 1_000_000 * USDC, &terms);
    // Not gated by residence: a US investor without a gate proof.
    let us = Address::generate(&s.env);
    s.usdc_admin.mint(&us, &(300_000 * USDC));
    assert_eq!(s.offering.try_invest(&id, &us, &(200_000 * USDC)), Err(err(Error::NotEligible)));

    let statement = BytesN::from_array(&s.env, &[7; 32]);
    s.offering.self_certify(&us, &statement);
    assert_eq!(s.offering.self_certification(&us).unwrap().statement, statement);
    assert_eq!(s.offering.try_invest(&id, &us, &(199_999 * USDC)), Err(err(Error::NotEligible)));
    s.offering.invest(&id, &us, &(200_000 * USDC));
    // Topping up stays eligible: the total is what counts.
    s.offering.invest(&id, &us, &(1_000 * USDC));
    assert_eq!(s.offering.contribution(&id, &us), 201_000 * USDC);
}

#[test]
fn reg_d_verifier_attestation_allows_any_ticket_until_it_expires() {
    let s = setup();
    let id = open(&s, 10 * USDC, 1_000 * USDC, &reg_d(&s));
    let a = Address::generate(&s.env);
    s.usdc_admin.mint(&a, &(100 * USDC));
    s.offering.attest_accredited(&s.verifier, &a, &1_500);
    assert!(s.offering.is_eligible_for(&id, &a, &(50 * USDC)));
    s.offering.invest(&id, &a, &(50 * USDC));
    s.env.ledger().set_timestamp(1_500);
    assert_eq!(s.offering.try_invest(&id, &a, &(50 * USDC)), Err(err(Error::NotEligible)));
    // Someone else's attestation doesn't count.
    let b = Address::generate(&s.env);
    let stranger = Address::generate(&s.env);
    s.offering.attest_accredited(&stranger, &b, &5_000);
    assert!(!s.offering.is_eligible_for(&id, &b, &(50 * USDC)));
}

#[test]
fn holder_cap_counts_primary_and_secondary() {
    let s = setup();
    let mut terms = reg_s(&s);
    terms.max_holders = 2;
    let id = open(&s, 10 * USDC, 100 * USDC, &terms);
    let a = investor(&s, 50 * USDC);
    let b = investor(&s, 50 * USDC);
    let c = investor(&s, 50 * USDC);
    s.offering.invest(&id, &a, &(10 * USDC));
    s.offering.invest(&id, &a, &(10 * USDC)); // same holder, counted once
    s.offering.invest(&id, &b, &(10 * USDC));
    assert_eq!(s.offering.try_invest(&id, &c, &(10 * USDC)), Err(err(Error::HolderCap)));
    s.env.ledger().set_timestamp(DEADLINE);
    assert_eq!(s.offering.try_authorize_holder(&id, &c), Err(err(Error::HolderCap)));
    assert_eq!(s.offering.raise(&id).holders, 2);
}

#[test]
fn raise_compliance_claws_back_with_a_reason_and_hands_over() {
    let s = setup();
    let id = open(&s, 10 * USDC, 100 * USDC, &reg_s(&s));
    let a = investor(&s, 100 * USDC);
    s.offering.invest(&id, &a, &(100 * USDC));
    s.offering.finalize(&id);
    s.env.ledger().set_timestamp(DEADLINE);
    s.offering.claim_tokens(&id, &a);

    let reason = soroban_sdk::String::from_str(&s.env, "Court order 2026/114");
    s.offering.clawback(&id, &a, &(30 * USDC), &reason);
    assert_eq!(s.env.auths()[0].0, s.compliance);
    assert_eq!(s.share.balance(&a), 70 * USDC);
    let empty = soroban_sdk::String::from_str(&s.env, "");
    assert_eq!(s.offering.try_clawback(&id, &a, &USDC, &empty), Err(err(Error::InvalidTerms)));
    assert_eq!(s.offering.try_clawback(&id, &a, &0, &reason), Err(err(Error::InvalidTerms)));

    let agent = Address::generate(&s.env);
    s.offering.set_raise_compliance(&id, &agent);
    assert_eq!(s.env.auths()[0].0, s.compliance);
    s.offering.freeze_holder(&id, &a, &reason);
    assert_eq!(s.env.auths()[0].0, agent);
}

#[test]
fn admin_sets_the_listing_fee() {
    let s = setup();
    s.offering.set_listing_fee(&0);
    assert_eq!(s.offering.config().listing_fee, 0);
    assert_eq!(s.offering.try_set_listing_fee(&-1), Err(err(Error::InvalidTerms)));
}
