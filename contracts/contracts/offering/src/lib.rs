#![no_std]
//! Fixed-price, all-or-nothing raises for company share tokens.
//!
//! Each company's share token is a classic Stellar asset issued with
//! AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED. Its Stellar Asset
//! Contract (SAC) admin is handed to this contract before the raise opens, so:
//! - only investors the gate has verified can ever hold the token, and
//! - tokens are minted once, exactly for what was sold. There is no other
//!   mint path and no way to move the SAC admin, so supply is fixed by code.

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, token, Address, Env,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const TTL_EXTEND_TO: u32 = 60 * DAY_IN_LEDGERS;
/// Share tokens and USDC both use 7 decimals; price is USDC units per whole token.
const TOKEN_UNIT: i128 = 10_000_000;
const BPS: i128 = 10_000;

#[contractclient(name = "GateClient")]
pub trait GateInterface {
    fn is_eligible(env: Env, investor: Address) -> bool;
}

#[contractclient(name = "RegistryClient")]
pub trait RegistryInterface {
    fn owner_if_active(env: Env, id: u32) -> Option<Address>;
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    CompanyNotActive = 1,
    NotTokenAdmin = 2,
    InvalidTerms = 3,
    RaiseNotFound = 4,
    NotOpen = 5,
    NotEligible = 6,
    OverMax = 7,
    TooEarly = 8,
    NothingToClaim = 9,
    WrongState = 10,
    TokenInUse = 11,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RaiseState {
    Open = 0,
    /// Minimum reached and closed: company paid, investors claim tokens.
    Succeeded = 1,
    /// Minimum missed by the deadline: investors claim refunds.
    Failed = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Raise {
    pub id: u32,
    pub company_id: u32,
    /// Company payout address (the registered owner when the raise opened).
    pub company: Address,
    /// SAC address of the company's share token.
    pub token: Address,
    /// USDC units (7 decimals) per whole share token.
    pub price: i128,
    pub min_raise: i128,
    pub max_raise: i128,
    pub deadline: u64,
    pub raised: i128,
    pub investors: u32,
    pub state: RaiseState,
    pub fee_paid: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub admin: Address,
    pub gate: Address,
    pub registry: Address,
    pub vault: Address,
    pub usdc: Address,
    pub treasury: Address,
    pub fee_bps: u32,
}

#[contracttype]
enum DataKey {
    Config,
    NextId,
    Raise(u32),
    Contribution(u32, Address),
    /// Share token → raise id, so a token can only ever back one raise.
    TokenRaise(Address),
}

#[contractevent]
pub struct RaiseOpened {
    #[topic]
    pub raise_id: u32,
    #[topic]
    pub company_id: u32,
    pub token: Address,
    pub price: i128,
    pub min_raise: i128,
    pub max_raise: i128,
    pub deadline: u64,
}

#[contractevent]
pub struct Invested {
    #[topic]
    pub raise_id: u32,
    #[topic]
    pub investor: Address,
    pub amount: i128,
    pub raised: i128,
}

#[contractevent]
pub struct RaiseClosed {
    #[topic]
    pub raise_id: u32,
    pub succeeded: bool,
    pub raised: i128,
    pub to_company: i128,
    pub fee: i128,
}

#[contractevent]
pub struct TokensClaimed {
    #[topic]
    pub raise_id: u32,
    #[topic]
    pub investor: Address,
    pub tokens: i128,
}

#[contractevent]
pub struct Refunded {
    #[topic]
    pub raise_id: u32,
    #[topic]
    pub investor: Address,
    pub amount: i128,
}

#[contractevent]
pub struct HolderAuthorized {
    #[topic]
    pub token: Address,
    pub holder: Address,
    pub authorized: bool,
}

#[contract]
pub struct Offering;

#[contractimpl]
impl Offering {
    pub fn __constructor(
        env: Env,
        admin: Address,
        gate: Address,
        registry: Address,
        vault: Address,
        usdc: Address,
        treasury: Address,
        fee_bps: u32,
    ) {
        if fee_bps > 2_000 {
            panic_with_error!(&env, Error::InvalidTerms);
        }
        let config = Config { admin, gate, registry, vault, usdc, treasury, fee_bps };
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::NextId, &1u32);
    }

    /// The company opens a raise. The share token's SAC admin must already be
    /// this contract.
    pub fn open_raise(
        env: Env,
        company_id: u32,
        token: Address,
        price: i128,
        min_raise: i128,
        max_raise: i128,
        deadline: u64,
    ) -> u32 {
        let config = config(&env);
        let company = RegistryClient::new(&env, &config.registry)
            .owner_if_active(&company_id)
            .unwrap_or_else(|| panic_with_error!(&env, Error::CompanyNotActive));
        company.require_auth();

        if price <= 0
            || min_raise <= 0
            || max_raise < min_raise
            || deadline <= env.ledger().timestamp()
        {
            panic_with_error!(&env, Error::InvalidTerms);
        }
        let sac = token::StellarAssetClient::new(&env, &token);
        if sac.admin() != env.current_contract_address() {
            panic_with_error!(&env, Error::NotTokenAdmin);
        }
        let token_key = DataKey::TokenRaise(token.clone());
        if env.storage().persistent().has(&token_key) {
            panic_with_error!(&env, Error::TokenInUse);
        }
        // The lock vault holds share tokens, so it needs an authorized balance.
        sac.set_authorized(&config.vault, &true);

        let id: u32 = env.storage().instance().get(&DataKey::NextId).unwrap();
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        let raise = Raise {
            id,
            company_id,
            company,
            token: token.clone(),
            price,
            min_raise,
            max_raise,
            deadline,
            raised: 0,
            investors: 0,
            state: RaiseState::Open,
            fee_paid: 0,
        };
        save_raise(&env, &raise);
        set_persistent(&env, &token_key, &id);
        RaiseOpened { raise_id: id, company_id, token, price, min_raise, max_raise, deadline }
            .publish(&env);
        id
    }

    /// A verified investor deposits USDC into escrow at the fixed price.
    pub fn invest(env: Env, raise_id: u32, investor: Address, amount: i128) {
        investor.require_auth();
        let config = config(&env);
        let mut raise = load_raise(&env, raise_id);
        if raise.state != RaiseState::Open || env.ledger().timestamp() >= raise.deadline {
            panic_with_error!(&env, Error::NotOpen);
        }
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidTerms);
        }
        if !GateClient::new(&env, &config.gate).is_eligible(&investor) {
            panic_with_error!(&env, Error::NotEligible);
        }
        if raise.raised + amount > raise.max_raise {
            panic_with_error!(&env, Error::OverMax);
        }
        token::TokenClient::new(&env, &config.usdc).transfer(
            &investor,
            &env.current_contract_address(),
            &amount,
        );

        let key = DataKey::Contribution(raise_id, investor.clone());
        let previous: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if previous == 0 {
            raise.investors += 1;
        }
        set_persistent(&env, &key, &(previous + amount));
        raise.raised += amount;
        save_raise(&env, &raise);
        Invested { raise_id, investor, amount, raised: raise.raised }.publish(&env);
    }

    /// Anyone can close a raise once it is full or past its deadline.
    /// Success pays the company (minus the platform fee); failure enables refunds.
    pub fn finalize(env: Env, raise_id: u32) -> RaiseState {
        let config = config(&env);
        let mut raise = load_raise(&env, raise_id);
        if raise.state != RaiseState::Open {
            panic_with_error!(&env, Error::WrongState);
        }
        let past_deadline = env.ledger().timestamp() >= raise.deadline;
        let full = raise.raised == raise.max_raise;
        if !past_deadline && !full {
            panic_with_error!(&env, Error::TooEarly);
        }

        if raise.raised >= raise.min_raise {
            let usdc = token::TokenClient::new(&env, &config.usdc);
            let fee = raise.raised * config.fee_bps as i128 / BPS;
            let to_company = raise.raised - fee;
            let this = env.current_contract_address();
            if fee > 0 {
                usdc.transfer(&this, &config.treasury, &fee);
            }
            usdc.transfer(&this, &raise.company, &to_company);
            raise.state = RaiseState::Succeeded;
            raise.fee_paid = fee;
            RaiseClosed { raise_id, succeeded: true, raised: raise.raised, to_company, fee }
                .publish(&env);
        } else {
            raise.state = RaiseState::Failed;
            RaiseClosed { raise_id, succeeded: false, raised: raise.raised, to_company: 0, fee: 0 }
                .publish(&env);
        }
        save_raise(&env, &raise);
        raise.state
    }

    /// After a successful raise, the investor receives their share tokens.
    /// This is the only place share tokens are ever minted.
    pub fn claim_tokens(env: Env, raise_id: u32, investor: Address) -> i128 {
        investor.require_auth();
        let raise = load_raise(&env, raise_id);
        if raise.state != RaiseState::Succeeded {
            panic_with_error!(&env, Error::WrongState);
        }
        let contribution = take_contribution(&env, raise_id, &investor);
        let tokens = contribution * TOKEN_UNIT / raise.price;
        let sac = token::StellarAssetClient::new(&env, &raise.token);
        sac.trust(&investor);
        sac.set_authorized(&investor, &true);
        sac.mint(&investor, &tokens);
        TokensClaimed { raise_id, investor, tokens }.publish(&env);
        tokens
    }

    /// After a failed raise, the investor gets their USDC back in full.
    pub fn refund(env: Env, raise_id: u32, investor: Address) -> i128 {
        let config = config(&env);
        let raise = load_raise(&env, raise_id);
        if raise.state != RaiseState::Failed {
            panic_with_error!(&env, Error::WrongState);
        }
        let amount = take_contribution(&env, raise_id, &investor);
        token::TokenClient::new(&env, &config.usdc).transfer(
            &env.current_contract_address(),
            &investor,
            &amount,
        );
        Refunded { raise_id, investor, amount }.publish(&env);
        amount
    }

    /// Lets a verified investor hold a share token they didn't buy in the raise,
    /// so they can buy it on the secondary market.
    pub fn authorize_holder(env: Env, raise_id: u32, holder: Address) {
        holder.require_auth();
        let config = config(&env);
        let raise = load_raise(&env, raise_id);
        if !GateClient::new(&env, &config.gate).is_eligible(&holder) {
            panic_with_error!(&env, Error::NotEligible);
        }
        let sac = token::StellarAssetClient::new(&env, &raise.token);
        sac.trust(&holder);
        sac.set_authorized(&holder, &true);
        HolderAuthorized { token: raise.token, holder, authorized: true }.publish(&env);
    }

    /// Platform admin freezes a holder (e.g. they became a US resident or a court order).
    /// The balance stays; transfers stop.
    pub fn revoke_holder(env: Env, raise_id: u32, holder: Address) {
        config(&env).admin.require_auth();
        let raise = load_raise(&env, raise_id);
        token::StellarAssetClient::new(&env, &raise.token).set_authorized(&holder, &false);
        HolderAuthorized { token: raise.token, holder, authorized: false }.publish(&env);
    }

    pub fn raise(env: Env, raise_id: u32) -> Raise {
        load_raise(&env, raise_id)
    }

    pub fn raise_count(env: Env) -> u32 {
        let next: u32 = env.storage().instance().get(&DataKey::NextId).unwrap();
        next - 1
    }

    pub fn contribution(env: Env, raise_id: u32, investor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(raise_id, investor))
            .unwrap_or(0)
    }

    pub fn config(env: Env) -> Config {
        config(&env)
    }
}

fn config(env: &Env) -> Config {
    env.storage().instance().get(&DataKey::Config).unwrap()
}

fn load_raise(env: &Env, id: u32) -> Raise {
    let key = DataKey::Raise(id);
    let raise: Raise = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| panic_with_error!(env, Error::RaiseNotFound));
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    raise
}

fn save_raise(env: &Env, raise: &Raise) {
    set_persistent(env, &DataKey::Raise(raise.id), raise);
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn take_contribution(env: &Env, raise_id: u32, investor: &Address) -> i128 {
    let key = DataKey::Contribution(raise_id, investor.clone());
    let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
    if amount <= 0 {
        panic_with_error!(env, Error::NothingToClaim);
    }
    env.storage().persistent().remove(&key);
    amount
}

fn set_persistent<V>(env: &Env, key: &DataKey, value: &V)
where
    V: soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
{
    env.storage().persistent().set(key, value);
    env.storage().persistent().extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

mod test;
