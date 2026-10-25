#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

const U: i128 = 10_000_000;

struct Setup {
    env: Env,
    vault: VaultClient<'static>,
    share: Address,
    share_admin: StellarAssetClient<'static>,
    usdc: TokenClient<'static>,
    company: Address,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    let usdc = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let share = env.register_stellar_asset_contract_v2(Address::generate(&env));
    let vault_id = env.register(Vault, (usdc.address(),));
    let company = Address::generate(&env);
    StellarAssetClient::new(&env, &usdc.address()).mint(&company, &(1_000_000 * U));
    Setup {
        vault: VaultClient::new(&env, &vault_id),
        share: share.address(),
        share_admin: StellarAssetClient::new(&env, &share.address()),
        usdc: TokenClient::new(&env, &usdc.address()),
        company,
        env,
    }
}

impl Setup {
    fn holder(&self, tokens: i128) -> Address {
        let a = Address::generate(&self.env);
        self.share_admin.mint(&a, &tokens);
        a
    }
    fn share_balance(&self, a: &Address) -> i128 {
        TokenClient::new(&self.env, &self.share).balance(a)
    }
}

#[test]
fn first_period_needs_explicit_start() {
    let s = setup();
    let a = s.holder(300 * U);
    s.vault.lock(&s.share, &a, &(300 * U));
    let p = s.vault.pool(&s.share);
    assert_eq!((p.period, p.active_total, p.pending_total), (0, 0, 300 * U));
    // Nothing is eligible yet, so a payout is refused rather than stranded.
    assert!(s.vault.try_distribute(&s.share, &s.company, &(10 * U)).is_err());

    assert_eq!(s.vault.start_period(&s.share), 1);
    assert_eq!(s.vault.pool(&s.share).active_total, 300 * U);
    // Can't restart while a period with earners is running.
    let b = s.holder(10 * U);
    s.vault.lock(&s.share, &b, &(10 * U));
    assert!(s.vault.try_start_period(&s.share).is_err());
}

#[test]
fn dividend_flow_across_periods() {
    let s = setup();
    let a = s.holder(300 * U);
    let b = s.holder(100 * U);
    let c = s.holder(400 * U);

    s.vault.lock(&s.share, &a, &(300 * U));
    s.vault.lock(&s.share, &b, &(100 * U));
    s.vault.start_period(&s.share);

    // Period 1: c locks mid-period (pending), b unlocks half (forfeits it for this period).
    s.vault.lock(&s.share, &c, &(400 * U));
    s.vault.unlock(&s.share, &b, &(50 * U));
    assert_eq!(s.share_balance(&b), 50 * U);

    // 70 USDC for period 1, shared by a (300) and b's remaining 50.
    s.vault.distribute(&s.share, &s.company, &(70 * U));
    assert_eq!(s.vault.position(&s.share, &a).owed, 60 * U);
    assert_eq!(s.vault.position(&s.share, &b).owed, 10 * U);
    assert_eq!(s.vault.position(&s.share, &c).owed, 0);

    // Period 2: a 300 + b 50 + c 400 = 750 eligible. Pay 75.
    s.vault.distribute(&s.share, &s.company, &(75 * U));
    assert_eq!(s.vault.claim(&s.share, &a), 90 * U);
    assert_eq!(s.vault.claim(&s.share, &b), 15 * U);
    assert_eq!(s.vault.claim(&s.share, &c), 40 * U);
    assert_eq!(s.usdc.balance(&a), 90 * U);

    assert_eq!(s.vault.claim(&s.share, &a), 0);
    s.vault.unlock(&s.share, &a, &(300 * U));
    assert_eq!(s.share_balance(&a), 300 * U);
    let p = s.vault.pool(&s.share);
    assert_eq!((p.period, p.active_total, p.total_distributed), (3, 450 * U, 145 * U));
}

#[test]
fn lock_right_before_payout_earns_nothing() {
    let s = setup();
    let loyal = s.holder(100 * U);
    let flipper = s.holder(1_000 * U);
    s.vault.lock(&s.share, &loyal, &(100 * U));
    s.vault.start_period(&s.share);

    s.vault.lock(&s.share, &flipper, &(1_000 * U));
    s.vault.distribute(&s.share, &s.company, &(50 * U));
    s.vault.unlock(&s.share, &flipper, &(1_000 * U));

    assert_eq!(s.vault.claim(&s.share, &flipper), 0);
    assert_eq!(s.vault.claim(&s.share, &loyal), 50 * U);
}

#[test]
fn adding_to_a_position_keeps_earlier_earnings() {
    let s = setup();
    let a = s.holder(200 * U);
    s.vault.lock(&s.share, &a, &(100 * U));
    s.vault.start_period(&s.share);
    s.vault.distribute(&s.share, &s.company, &(10 * U)); // a earns 10, period 2 starts
    s.vault.lock(&s.share, &a, &(100 * U)); // pending until period 3
    s.vault.distribute(&s.share, &s.company, &(10 * U)); // only the first 100 earns: 10
    s.vault.distribute(&s.share, &s.company, &(10 * U)); // all 200 earn: 10
    assert_eq!(s.vault.claim(&s.share, &a), 30 * U);
}

#[test]
fn rejects_bad_amounts() {
    let s = setup();
    let a = s.holder(10 * U);
    assert!(s.vault.try_lock(&s.share, &a, &0).is_err());
    s.vault.lock(&s.share, &a, &(10 * U));
    assert!(s.vault.try_unlock(&s.share, &a, &(11 * U)).is_err());
}
