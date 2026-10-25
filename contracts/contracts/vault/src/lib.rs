#![no_std]
//! Lock vault and USDC dividends for company share tokens.
//!
//! The rule: a dividend is shared only by tokens that stayed locked for the
//! whole period it covers. A period runs from one `distribute` to the next.
//! - Tokens locked during a period are *pending*; they start earning when the
//!   next period begins (at the next `distribute`).
//! - Tokens unlocked during a period earn nothing for that period.
//! So locking right before a payout and selling right after earns nothing.
//!
//! Accounting is O(1) per call: a reward-per-token accumulator per share token,
//! plus a snapshot of the accumulator at the start of each period.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, token,
    Address, Env,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const TTL_EXTEND_TO: u32 = 14 * DAY_IN_LEDGERS;
/// Fixed-point scale for the reward-per-token accumulator.
const SCALE: i128 = 1_000_000_000_000_000_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    InsufficientLocked = 2,
    NoEligibleTokens = 3,
    PeriodRunning = 4,
}

/// Per share token.
#[contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct Pool {
    /// Current period number; period 0 starts when the first token is locked.
    pub period: u32,
    /// Accumulated USDC per eligible token, times SCALE.
    pub acc: i128,
    /// Tokens earning in the current period.
    pub active_total: i128,
    /// Tokens locked this period, earning from the next one.
    pub pending_total: i128,
    pub total_distributed: i128,
    pub last_distribution: u64,
}

/// Per (share token, holder).
#[contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct Position {
    pub active: i128,
    pub pending: i128,
    /// Period in which `pending` becomes active.
    pub pending_from: u32,
    /// Accumulator value `active` has already been credited up to.
    pub debt: i128,
    /// Settled, unclaimed USDC.
    pub owed: i128,
}

#[contracttype]
enum DataKey {
    Usdc,
    Pool(Address),
    /// Accumulator at the start of a period: (token, period).
    PeriodStart(Address, u32),
    Position(Address, Address),
}

#[contractevent]
pub struct Locked {
    #[topic]
    pub token: Address,
    #[topic]
    pub holder: Address,
    pub amount: i128,
    pub earning_from_period: u32,
}

#[contractevent]
pub struct Unlocked {
    #[topic]
    pub token: Address,
    #[topic]
    pub holder: Address,
    pub amount: i128,
}

#[contractevent]
pub struct PeriodStarted {
    #[topic]
    pub token: Address,
    pub period: u32,
    pub eligible_tokens: i128,
}

#[contractevent]
pub struct Distributed {
    #[topic]
    pub token: Address,
    pub from: Address,
    pub period: u32,
    pub amount: i128,
    pub eligible_tokens: i128,
}

#[contractevent]
pub struct Claimed {
    #[topic]
    pub token: Address,
    #[topic]
    pub holder: Address,
    pub amount: i128,
}

#[contract]
pub struct Vault;

#[contractimpl]
impl Vault {
    pub fn __constructor(env: Env, usdc: Address) {
        env.storage().instance().set(&DataKey::Usdc, &usdc);
    }

    /// Lock share tokens. They earn from the next period onward.
    pub fn lock(env: Env, token: Address, holder: Address, amount: i128) {
        holder.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let mut pool = load_pool(&env, &token);
        let mut pos = settle(&env, &token, &pool, load_position(&env, &token, &holder));

        token::TokenClient::new(&env, &token).transfer(
            &holder,
            &env.current_contract_address(),
            &amount,
        );
        pos.pending += amount;
        pos.pending_from = pool.period + 1;
        pool.pending_total += amount;

        save_pool(&env, &token, &pool);
        save_position(&env, &token, &holder, &pos);
        Locked { token, holder, amount, earning_from_period: pool.period + 1 }.publish(&env);
    }

    /// Unlock share tokens at any time. Pending tokens are returned first.
    /// Active tokens unlocked now earn nothing for the current period.
    pub fn unlock(env: Env, token: Address, holder: Address, amount: i128) {
        holder.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let mut pool = load_pool(&env, &token);
        let mut pos = settle(&env, &token, &pool, load_position(&env, &token, &holder));
        if amount > pos.pending + pos.active {
            panic_with_error!(&env, Error::InsufficientLocked);
        }
        let from_pending = amount.min(pos.pending);
        let from_active = amount - from_pending;
        pos.pending -= from_pending;
        pool.pending_total -= from_pending;
        pos.active -= from_active;
        pool.active_total -= from_active;

        token::TokenClient::new(&env, &token).transfer(
            &env.current_contract_address(),
            &holder,
            &amount,
        );
        save_pool(&env, &token, &pool);
        save_position(&env, &token, &holder, &pos);
        Unlocked { token, holder, amount }.publish(&env);
    }

    /// Starts the first earning period when nothing is earning yet (for
    /// example right after a raise, once holders have locked). Pending tokens
    /// become active. Once anything is active, periods advance only through
    /// `distribute`, so no one can be diluted by an early period change.
    pub fn start_period(env: Env, token: Address) -> u32 {
        let mut pool = load_pool(&env, &token);
        if pool.active_total != 0 || pool.pending_total <= 0 {
            panic_with_error!(&env, Error::PeriodRunning);
        }
        pool.period += 1;
        pool.active_total = pool.pending_total;
        pool.pending_total = 0;
        let start_key = DataKey::PeriodStart(token.clone(), pool.period);
        env.storage().persistent().set(&start_key, &pool.acc);
        env.storage().persistent().extend_ttl(&start_key, TTL_THRESHOLD, TTL_EXTEND_TO);
        save_pool(&env, &token, &pool);
        PeriodStarted { token, period: pool.period, eligible_tokens: pool.active_total }
            .publish(&env);
        pool.period
    }

    /// The company pays a dividend for the period that just ended. It is
    /// shared pro-rata by tokens locked for that whole period, and a new
    /// period begins.
    pub fn distribute(env: Env, token: Address, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let mut pool = load_pool(&env, &token);
        if pool.active_total <= 0 {
            panic_with_error!(&env, Error::NoEligibleTokens);
        }
        token::TokenClient::new(&env, &usdc(&env)).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );

        let eligible = pool.active_total;
        let paid_period = pool.period;
        pool.acc += amount * SCALE / eligible;
        pool.period += 1;
        pool.active_total += pool.pending_total;
        pool.pending_total = 0;
        pool.total_distributed += amount;
        pool.last_distribution = env.ledger().timestamp();

        let start_key = DataKey::PeriodStart(token.clone(), pool.period);
        env.storage().persistent().set(&start_key, &pool.acc);
        env.storage().persistent().extend_ttl(&start_key, TTL_THRESHOLD, TTL_EXTEND_TO);
        save_pool(&env, &token, &pool);
        Distributed { token, from, period: paid_period, amount, eligible_tokens: eligible }
            .publish(&env);
    }

    /// Pay out all USDC dividends the holder has earned.
    pub fn claim(env: Env, token: Address, holder: Address) -> i128 {
        holder.require_auth();
        let pool = load_pool(&env, &token);
        let mut pos = settle(&env, &token, &pool, load_position(&env, &token, &holder));
        let amount = pos.owed;
        if amount > 0 {
            pos.owed = 0;
            token::TokenClient::new(&env, &usdc(&env)).transfer(
                &env.current_contract_address(),
                &holder,
                &amount,
            );
            Claimed { token: token.clone(), holder: holder.clone(), amount }.publish(&env);
        }
        save_position(&env, &token, &holder, &pos);
        amount
    }

    pub fn pool(env: Env, token: Address) -> Pool {
        load_pool(&env, &token)
    }

    /// The holder's position with everything earned so far settled into `owed`.
    pub fn position(env: Env, token: Address, holder: Address) -> Position {
        let pool = load_pool(&env, &token);
        settle(&env, &token, &pool, load_position(&env, &token, &holder))
    }
}

/// Credits everything the position has earned up to now.
fn settle(env: &Env, token: &Address, pool: &Pool, mut pos: Position) -> Position {
    if pos.pending > 0 && pool.period >= pos.pending_from {
        // Credit `active` up to the period where `pending` joined, then merge.
        let start: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::PeriodStart(token.clone(), pos.pending_from))
            .unwrap();
        pos.owed += pos.active * (start - pos.debt) / SCALE;
        pos.active += pos.pending;
        pos.pending = 0;
        pos.debt = start;
    }
    pos.owed += pos.active * (pool.acc - pos.debt) / SCALE;
    pos.debt = pool.acc;
    pos
}

fn usdc(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Usdc).unwrap()
}

fn load_pool(env: &Env, token: &Address) -> Pool {
    env.storage()
        .persistent()
        .get(&DataKey::Pool(token.clone()))
        .unwrap_or_default()
}

fn save_pool(env: &Env, token: &Address, pool: &Pool) {
    let key = DataKey::Pool(token.clone());
    env.storage().persistent().set(&key, pool);
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn load_position(env: &Env, token: &Address, holder: &Address) -> Position {
    env.storage()
        .persistent()
        .get(&DataKey::Position(token.clone(), holder.clone()))
        .unwrap_or_default()
}

fn save_position(env: &Env, token: &Address, holder: &Address, pos: &Position) {
    let key = DataKey::Position(token.clone(), holder.clone());
    if *pos == Position::default() {
        env.storage().persistent().remove(&key);
        return;
    }
    env.storage().persistent().set(&key, pos);
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

mod test;
