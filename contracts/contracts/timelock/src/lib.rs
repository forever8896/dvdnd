#![no_std]
//! A timelock between the council and the contracts it administers.
//!
//! The registry and offering contracts take this contract as their admin. The
//! proposer (the 2-of-3 council) *schedules* a call; after the delay anyone can
//! *execute* it; until then the proposer can *cancel* it. Holders and companies
//! see every pending admin change on-chain before it can take effect.
//! Changing the delay or the proposer is a scheduled call to this contract
//! (`set_delay` / `set_proposer` as the function), so it waits out the current
//! delay too. Soroban forbids re-entry, so those two are applied in `execute`
//! rather than through a call back into the contract.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, xdr::ToXdr,
    Address, BytesN, Env, IntoVal, Symbol, TryIntoVal, Val, Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const TTL_EXTEND_TO: u32 = 14 * DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotFound = 1,
    TooEarly = 2,
    AlreadyScheduled = 3,
    BadArgs = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Call {
    pub target: Address,
    pub function: Symbol,
    pub args: Vec<Val>,
    /// Earliest execution time.
    pub eta: u64,
}

#[contracttype]
enum DataKey {
    Proposer,
    Delay,
    Call(BytesN<32>),
}

#[contractevent]
pub struct Scheduled {
    #[topic]
    pub id: BytesN<32>,
    pub target: Address,
    pub function: Symbol,
    pub eta: u64,
}

#[contractevent]
pub struct Executed {
    #[topic]
    pub id: BytesN<32>,
}

#[contractevent]
pub struct Cancelled {
    #[topic]
    pub id: BytesN<32>,
}

#[contract]
pub struct Timelock;

#[contractimpl]
impl Timelock {
    pub fn __constructor(env: Env, proposer: Address, delay: u64) {
        env.storage().instance().set(&DataKey::Proposer, &proposer);
        env.storage().instance().set(&DataKey::Delay, &delay);
    }

    /// The proposer schedules `target.function(args)`; returns its id.
    pub fn schedule(env: Env, target: Address, function: Symbol, args: Vec<Val>) -> BytesN<32> {
        proposer(&env).require_auth();
        let eta = env.ledger().timestamp() + delay(&env);
        // The id depends only on what is called, never on the time: storage keys
        // must be known when the transaction is simulated, before it lands.
        let id: BytesN<32> = env.crypto().sha256(&(target.clone(), function.clone(), args.clone()).to_xdr(&env)).into();
        let call = Call { target: target.clone(), function: function.clone(), args, eta };
        let key = DataKey::Call(id.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::AlreadyScheduled);
        }
        env.storage().persistent().set(&key, &call);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
        Scheduled { id: id.clone(), target, function, eta }.publish(&env);
        id
    }

    /// Anyone runs a scheduled call once its delay has passed.
    pub fn execute(env: Env, id: BytesN<32>) -> Val {
        let key = DataKey::Call(id.clone());
        let call: Call = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));
        if env.ledger().timestamp() < call.eta {
            panic_with_error!(&env, Error::TooEarly);
        }
        env.storage().persistent().remove(&key);
        Executed { id }.publish(&env);
        if call.target == env.current_contract_address() {
            return apply_own(&env, &call);
        }
        env.invoke_contract::<Val>(&call.target, &call.function, call.args)
    }

    /// The proposer drops a scheduled call before it runs.
    pub fn cancel(env: Env, id: BytesN<32>) {
        proposer(&env).require_auth();
        let key = DataKey::Call(id.clone());
        if !env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::NotFound);
        }
        env.storage().persistent().remove(&key);
        Cancelled { id }.publish(&env);
    }

    pub fn call(env: Env, id: BytesN<32>) -> Option<Call> {
        env.storage().persistent().get(&DataKey::Call(id))
    }

    pub fn delay(env: Env) -> u64 {
        delay(&env)
    }

    pub fn proposer(env: Env) -> Address {
        proposer(&env)
    }
}

fn proposer(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Proposer).unwrap()
}

fn delay(env: &Env) -> u64 {
    env.storage().instance().get(&DataKey::Delay).unwrap()
}

/// A scheduled change to the timelock's own settings.
fn apply_own(env: &Env, call: &Call) -> Val {
    let arg = call.args.get(0).unwrap_or_else(|| panic_with_error!(env, Error::BadArgs));
    if call.function == Symbol::new(env, "set_delay") {
        let delay: u64 = arg.try_into_val(env).unwrap_or_else(|_| panic_with_error!(env, Error::BadArgs));
        env.storage().instance().set(&DataKey::Delay, &delay);
    } else if call.function == Symbol::new(env, "set_proposer") {
        let proposer: Address = arg.try_into_val(env).unwrap_or_else(|_| panic_with_error!(env, Error::BadArgs));
        env.storage().instance().set(&DataKey::Proposer, &proposer);
    } else {
        panic_with_error!(env, Error::BadArgs);
    }
    ().into_val(env)
}


mod test;
