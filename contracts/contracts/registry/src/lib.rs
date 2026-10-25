#![no_std]
//! Company registry: who the company is, whether the platform has verified it,
//! and the profit-share agreement it signed.
//!
//! Roles: the *verifier* (an automated service key) records ownership checks;
//! the *admin* (a multisig council) suspends companies and reassigns roles.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, symbol_short,
    Address, BytesN, Env, String, Symbol,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const TTL_EXTEND_TO: u32 = 60 * DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotFound = 1,
    NotVerified = 2,
    AlreadySigned = 3,
    InvalidPayout = 4,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Status {
    /// Registered, waiting for the platform's ownership/KYB check.
    Pending = 0,
    /// Ownership verified by the platform.
    Verified = 1,
    /// Verified and the profit-share agreement is signed. Can open a raise.
    Active = 2,
    /// Removed from the platform.
    Suspended = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Company {
    pub id: u32,
    pub owner: Address,
    pub name: String,
    /// ISO 3166-1 numeric country of incorporation.
    pub country: u32,
    /// Off-chain profile (links, socials, financials) as a URL.
    pub profile_uri: String,
    pub status: Status,
    /// Hash of the platform's KYB / ownership evidence bundle.
    pub kyb_hash: Option<BytesN<32>>,
    /// SHA-256 of the signed agreement PDF.
    pub agreement_hash: Option<BytesN<32>>,
    /// Share of yearly net profit committed to holders, in basis points.
    pub payout_bps: u32,
    /// Dividend period length in seconds (e.g. one year).
    pub period_secs: u64,
}

#[contracttype]
enum DataKey {
    Admin,
    Verifier,
    NextId,
    Company(u32),
}

#[contractevent]
pub struct CompanyRegistered {
    #[topic]
    pub id: u32,
    pub owner: Address,
}

#[contractevent]
pub struct RoleChanged {
    #[topic]
    pub role: Symbol,
    pub account: Address,
}

#[contractevent]
pub struct CompanySuspended {
    #[topic]
    pub id: u32,
}

#[contractevent]
pub struct CompanyVerified {
    #[topic]
    pub id: u32,
    pub kyb_hash: BytesN<32>,
}

#[contractevent]
pub struct AgreementSigned {
    #[topic]
    pub id: u32,
    pub agreement_hash: BytesN<32>,
    pub payout_bps: u32,
    pub period_secs: u64,
}

#[contract]
pub struct Registry;

#[contractimpl]
impl Registry {
    pub fn __constructor(env: Env, admin: Address, verifier: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Verifier, &verifier);
        env.storage().instance().set(&DataKey::NextId, &1u32);
    }

    /// A company owner registers their business. Starts as `Pending`.
    pub fn register(
        env: Env,
        owner: Address,
        name: String,
        country: u32,
        profile_uri: String,
    ) -> u32 {
        owner.require_auth();
        let id: u32 = env.storage().instance().get(&DataKey::NextId).unwrap();
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        let company = Company {
            id,
            owner: owner.clone(),
            name,
            country,
            profile_uri,
            status: Status::Pending,
            kyb_hash: None,
            agreement_hash: None,
            payout_bps: 0,
            period_secs: 0,
        };
        save(&env, &company);
        CompanyRegistered { id, owner }.publish(&env);
        id
    }

    /// The verifier records that ownership was verified (registry match, domain, KYB).
    pub fn verify(env: Env, id: u32, kyb_hash: BytesN<32>) {
        verifier(&env).require_auth();
        let mut company = load(&env, id);
        company.status = Status::Verified;
        company.kyb_hash = Some(kyb_hash.clone());
        save(&env, &company);
        CompanyVerified { id, kyb_hash }.publish(&env);
    }

    /// The owner signs the profit-share agreement. Binding terms live in the PDF;
    /// its hash and the headline numbers are recorded here.
    pub fn sign_agreement(
        env: Env,
        id: u32,
        agreement_hash: BytesN<32>,
        payout_bps: u32,
        period_secs: u64,
    ) {
        let mut company = load(&env, id);
        company.owner.require_auth();
        match company.status {
            Status::Verified => {}
            Status::Active => panic_with_error!(&env, Error::AlreadySigned),
            _ => panic_with_error!(&env, Error::NotVerified),
        }
        if payout_bps == 0 || payout_bps > 10_000 || period_secs == 0 {
            panic_with_error!(&env, Error::InvalidPayout);
        }
        company.status = Status::Active;
        company.agreement_hash = Some(agreement_hash.clone());
        company.payout_bps = payout_bps;
        company.period_secs = period_secs;
        save(&env, &company);
        AgreementSigned { id, agreement_hash, payout_bps, period_secs }.publish(&env);
    }

    pub fn suspend(env: Env, id: u32) {
        admin(&env).require_auth();
        let mut company = load(&env, id);
        company.status = Status::Suspended;
        save(&env, &company);
        CompanySuspended { id }.publish(&env);
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        RoleChanged { role: symbol_short!("admin"), account: new_admin }.publish(&env);
    }

    pub fn set_verifier(env: Env, new_verifier: Address) {
        admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Verifier, &new_verifier);
        RoleChanged { role: symbol_short!("verifier"), account: new_verifier }.publish(&env);
    }

    pub fn admin(env: Env) -> Address {
        admin(&env)
    }

    pub fn verifier(env: Env) -> Address {
        verifier(&env)
    }

    pub fn company(env: Env, id: u32) -> Company {
        load(&env, id)
    }

    pub fn count(env: Env) -> u32 {
        let next: u32 = env.storage().instance().get(&DataKey::NextId).unwrap();
        next - 1
    }

    /// Owner address if the company may raise (verified and agreement signed).
    /// Consumed by the offering contract.
    pub fn owner_if_active(env: Env, id: u32) -> Option<Address> {
        let key = DataKey::Company(id);
        let company: Option<Company> = env.storage().persistent().get(&key);
        company
            .filter(|c| c.status == Status::Active)
            .map(|c| c.owner)
    }
}

fn admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

fn verifier(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Verifier).unwrap()
}

fn load(env: &Env, id: u32) -> Company {
    let key = DataKey::Company(id);
    match env.storage().persistent().get(&key) {
        Some(c) => {
            env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
            c
        }
        None => panic_with_error!(env, Error::NotFound),
    }
}

fn save(env: &Env, company: &Company) {
    let key = DataKey::Company(company.id);
    env.storage().persistent().set(&key, company);
    env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

mod test;
