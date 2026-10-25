#![cfg(test)]

use super::*;
use soroban_sdk::{
    contract, contractimpl, symbol_short,
    testutils::{Address as _, Ledger},
    vec, Address, Env, IntoVal,
};

/// Stands in for registry/offering: an admin-only setter.
#[contract]
struct Target;

#[contractimpl]
impl Target {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&symbol_short!("admin"), &admin);
    }
    pub fn set_fee(env: Env, fee: i128) {
        let admin: Address = env.storage().instance().get(&symbol_short!("admin")).unwrap();
        admin.require_auth();
        env.storage().instance().set(&symbol_short!("fee"), &fee);
    }
    pub fn fee(env: Env) -> i128 {
        env.storage().instance().get(&symbol_short!("fee")).unwrap_or(0)
    }
}

const DELAY: u64 = 3_600;

fn setup() -> (Env, TimelockClient<'static>, TargetClient<'static>, Address) {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let council = Address::generate(&env);
    let lock = env.register(Timelock, (council.clone(), DELAY));
    let target = env.register(Target, (lock.clone(),));
    (env.clone(), TimelockClient::new(&env, &lock), TargetClient::new(&env, &target), council)
}

fn failed_with<T>(r: Result<T, Result<soroban_sdk::Error, soroban_sdk::InvokeError>>, e: Error) -> bool {
    matches!(r, Err(Ok(x)) if x == soroban_sdk::Error::from_contract_error(e as u32))
}

#[test]
fn admin_call_runs_only_after_the_delay() {
    let (env, lock, target, council) = setup();
    env.mock_all_auths();
    let id = lock.schedule(&target.address, &Symbol::new(&env, "set_fee"), &vec![&env, 120i128.into_val(&env)]);
    assert_eq!(env.auths()[0].0, council);
    assert_eq!(lock.call(&id).unwrap().eta, 1_000 + DELAY);

    assert!(failed_with(lock.try_execute(&id), Error::TooEarly));
    env.ledger().set_timestamp(1_000 + DELAY);
    // No auth needed to execute; the target sees the timelock as its admin.
    env.set_auths(&[]);
    lock.execute(&id);
    assert_eq!(target.fee(), 120);
    assert!(failed_with(lock.try_execute(&id), Error::NotFound));
}

#[test]
fn proposer_cancels_and_only_the_proposer_schedules() {
    let (env, lock, target, _) = setup();
    env.mock_all_auths();
    let id = lock.schedule(&target.address, &Symbol::new(&env, "set_fee"), &vec![&env, 5i128.into_val(&env)]);
    lock.cancel(&id);
    env.ledger().set_timestamp(1_000 + DELAY);
    assert!(failed_with(lock.try_execute(&id), Error::NotFound));

    env.set_auths(&[]);
    assert!(lock.try_schedule(&target.address, &Symbol::new(&env, "set_fee"), &vec![&env, 7i128.into_val(&env)]).is_err());
}

#[test]
fn the_target_refuses_anyone_but_the_timelock() {
    let (env, _, target, council) = setup();
    env.set_auths(&[]);
    // The council itself can no longer call the admin function directly.
    assert!(target.try_set_fee(&1).is_err());
    let _ = council;
}

#[test]
fn delay_changes_wait_out_the_current_delay() {
    let (env, lock, _, _) = setup();
    env.mock_all_auths();
    let id = lock.schedule(&lock.address, &Symbol::new(&env, "set_delay"), &vec![&env, 60u64.into_val(&env)]);
    env.set_auths(&[]);
    assert!(failed_with(lock.try_execute(&id), Error::TooEarly));
    env.ledger().set_timestamp(1_000 + DELAY);
    lock.execute(&id);
    assert_eq!(lock.delay(), 60);
}

#[test]
fn proposer_change_is_scheduled_too() {
    let (env, lock, _, _) = setup();
    env.mock_all_auths();
    let next = Address::generate(&env);
    let id = lock.schedule(&lock.address, &Symbol::new(&env, "set_proposer"), &vec![&env, next.into_val(&env)]);
    env.ledger().set_timestamp(1_000 + DELAY);
    lock.execute(&id);
    assert_eq!(lock.proposer(), next);
}

#[test]
fn id_does_not_depend_on_the_time() {
    let (env, lock, target, _) = setup();
    env.mock_all_auths();
    let args = vec![&env, 9i128.into_val(&env)];
    let a = lock.schedule(&target.address, &Symbol::new(&env, "set_fee"), &args);
    lock.cancel(&a);
    env.ledger().set_timestamp(5_000);
    let b = lock.schedule(&target.address, &Symbol::new(&env, "set_fee"), &args);
    assert_eq!(a, b);
}
