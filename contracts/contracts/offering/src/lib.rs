#![no_std]
//! Fixed-price, all-or-nothing raises for company share tokens, each under a
//! securities exemption with its own rules.
//!
//! Each company's share token is a classic Stellar asset issued with
//! AUTH_REQUIRED | AUTH_REVOCABLE | AUTH_CLAWBACK_ENABLED. Its Stellar Asset
//! Contract (SAC) admin is handed to this contract before the raise opens, so:
//! - only investors eligible for the raise's exemption can ever hold the token,
//! - tokens are minted once, exactly for what was sold. There is no other
//!   mint path and no way to move the SAC admin, so supply is fixed by code.
//!
//! Every raise carries its own terms:
//! - *exemption*: Reg S (non-US residents, proven to the gate with a ZK
//!   proof), Reg D 506(c) (accredited investors: attested by the raise's
//!   accreditation verifier, or a signed self-certification with at least
//!   $200,000 invested, or $1,000,000 for an entity, the SEC staff's March
//!   2025 high-minimum route), or both side by side, so non-US investors
//!   qualify by residence and US investors by accreditation,
//! - a minimum ticket and a cap on holders (Exchange Act §12(g) margin),
//! - a lock-up date: until then, claimed tokens go straight into the dividend
//!   vault and the holder's wallet is frozen, so they earn but can't move, and
//!   no new holders are authorized,
//! - its own *compliance* account (the company or its transfer agent), which
//!   alone can freeze, unfreeze and claw back, each with a recorded reason.
//!
//! The platform takes a flat listing fee when a raise opens, never a share of
//! what is raised, and never controls investor funds: escrowed USDC can only
//! go to the company on success or back to investors on failure.

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, symbol_short, token, Address, BytesN, Env, String, Symbol,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const TTL_EXTEND_TO: u32 = 14 * DAY_IN_LEDGERS;
/// Share tokens and USDC both use 7 decimals; price is USDC units per whole token.
const TOKEN_UNIT: i128 = 10_000_000;
/// Rule 506(c) high-minimum route: at least $200,000 from a natural person...
pub const SELF_CERTIFIED_MINIMUM: i128 = 200_000 * TOKEN_UNIT;
/// ...and at least $1,000,000 from a legal entity.
pub const ENTITY_SELF_CERTIFIED_MINIMUM: i128 = 1_000_000 * TOKEN_UNIT;
/// Rule 144 holding period for a non-reporting issuer's restricted securities.
pub const REG_D_LOCKUP_SECS: u64 = 365 * 24 * 60 * 60;
/// Exchange Act §12(g) registration starts at 2,000 holders of record.
pub const MAX_HOLDERS: u32 = 2_000;

#[contractclient(name = "GateClient")]
pub trait GateInterface {
    fn is_eligible(env: Env, investor: Address) -> bool;
}

#[contractclient(name = "RegistryClient")]
pub trait RegistryInterface {
    fn owner_if_active(env: Env, id: u32) -> Option<Address>;
}

#[contractclient(name = "VaultClient")]
pub trait VaultInterface {
    fn lock(env: Env, token: Address, holder: Address, amount: i128);
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
    BelowMinimum = 12,
    HolderCap = 13,
    LockedUp = 14,
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
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Exemption {
    /// Regulation S: offered only to people resident outside the US.
    RegS = 0,
    /// Rule 506(c) of Regulation D: accredited investors, verified.
    RegD506c = 1,
    /// Both at once: non-US residents under Reg S, accredited investors
    /// (including US residents) under 506(c). Takes the Reg D lock-up.
    RegSAnd506c = 2,
}

/// What the company chooses when it opens a raise.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Terms {
    pub exemption: Exemption,
    /// Smallest total contribution per investor, in USDC units.
    pub min_ticket: i128,
    /// Most holders the token may ever have (primary plus secondary).
    pub max_holders: u32,
    /// Until this time, tokens can't leave the dividend vault and no new
    /// holders are authorized. Reg D raises need at least a year after the deadline.
    pub lockup_until: u64,
    /// The company or its transfer agent: freezes, unfreezes and claws back.
    pub compliance: Address,
    /// Accreditation verifier for 506(c) (e.g. a verification service). Its
    /// attestation replaces the $200,000 minimum for self-certified investors.
    pub verifier: Option<Address>,
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
    /// Distinct accounts ever authorized to hold the token.
    pub holders: u32,
    pub state: RaiseState,
    /// Flat listing fee the company paid when opening.
    pub fee_paid: i128,
    pub terms: Terms,
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
    /// Flat fee in USDC units per raise, not tied to the amount raised.
    pub listing_fee: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Accreditation {
    /// sha256 of the written statement the investor signed.
    pub statement: BytesN<32>,
    /// Signed for a legal entity (company, fund, trust), which needs the higher minimum.
    pub entity: bool,
    pub at: u64,
}

#[contracttype]
enum DataKey {
    Config,
    NextId,
    Raise(u32),
    Contribution(u32, Address),
    /// Share token → raise id, so a token can only ever back one raise.
    TokenRaise(Address),
    /// Counted toward the raise's holder cap.
    Holder(u32, Address),
    /// The investor's own accreditation statement (506(c)).
    SelfCertified(Address),
    /// A verifier's attestation, valid until the stored time.
    Attested(Address, Address),
    /// Frozen by lock-up (not by compliance), so `release` may lift it.
    LockupFrozen(u32, Address),
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
    pub terms: Terms,
    pub fee: i128,
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
}

#[contractevent]
pub struct TokensClaimed {
    #[topic]
    pub raise_id: u32,
    #[topic]
    pub investor: Address,
    pub tokens: i128,
    /// True when the tokens went into the vault under lock-up.
    pub locked_up: bool,
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
pub struct ComplianceAction {
    #[topic]
    pub token: Address,
    #[topic]
    pub holder: Address,
    pub action: Symbol,
    pub amount: i128,
    pub reason: String,
}

#[contractevent]
pub struct RoleChanged {
    #[topic]
    pub role: Symbol,
    pub account: Address,
    pub raise_id: u32,
}

#[contractevent]
pub struct HolderAuthorized {
    #[topic]
    pub token: Address,
    pub holder: Address,
    pub authorized: bool,
}

#[contractevent]
pub struct AccreditationRecorded {
    #[topic]
    pub investor: Address,
    /// The verifier, or the investor themselves for a self-certification.
    pub by: Address,
    pub until: u64,
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
        listing_fee: i128,
    ) {
        if listing_fee < 0 {
            panic_with_error!(&env, Error::InvalidTerms);
        }
        let config = Config { admin, gate, registry, vault, usdc, treasury, listing_fee };
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::NextId, &1u32);
    }

    /// The company opens a raise and pays the flat listing fee. The share
    /// token's SAC admin must already be this contract.
    pub fn open_raise(
        env: Env,
        company_id: u32,
        token: Address,
        price: i128,
        min_raise: i128,
        max_raise: i128,
        deadline: u64,
        terms: Terms,
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
            || terms.min_ticket < 0
            || terms.min_ticket > max_raise
            || terms.max_holders == 0
            || terms.max_holders > MAX_HOLDERS
            || terms.lockup_until < deadline
            || (terms.exemption != Exemption::RegS
                && terms.lockup_until < deadline + REG_D_LOCKUP_SECS)
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
        if config.listing_fee > 0 {
            token::TokenClient::new(&env, &config.usdc).transfer(
                &company,
                &config.treasury,
                &config.listing_fee,
            );
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
            holders: 0,
            state: RaiseState::Open,
            fee_paid: config.listing_fee,
            terms: terms.clone(),
        };
        save_raise(&env, &raise);
        set_persistent(&env, &token_key, &id);
        RaiseOpened {
            raise_id: id,
            company_id,
            token,
            price,
            min_raise,
            max_raise,
            deadline,
            terms,
            fee: config.listing_fee,
        }
        .publish(&env);
        id
    }

    /// An investor records their own accreditation statement for 506(c)
    /// raises: `statement` is the sha256 of the text they agreed to, `entity`
    /// whether they invest for a legal entity. Without a verifier's
    /// attestation, it only counts with $200,000 or more invested ($1,000,000
    /// for an entity).
    pub fn self_certify(env: Env, investor: Address, statement: BytesN<32>, entity: bool) {
        investor.require_auth();
        let at = env.ledger().timestamp();
        set_persistent(&env, &DataKey::SelfCertified(investor.clone()), &Accreditation { statement, entity, at });
        AccreditationRecorded { investor: investor.clone(), by: investor, until: u64::MAX }.publish(&env);
    }

    /// An accreditation verifier attests an investor until `until`.
    pub fn attest_accredited(env: Env, verifier: Address, investor: Address, until: u64) {
        verifier.require_auth();
        if until <= env.ledger().timestamp() {
            panic_with_error!(&env, Error::InvalidTerms);
        }
        set_persistent(&env, &DataKey::Attested(verifier.clone(), investor.clone()), &until);
        AccreditationRecorded { investor, by: verifier, until }.publish(&env);
    }

    /// An eligible investor deposits USDC into escrow at the fixed price.
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
        if raise.raised + amount > raise.max_raise {
            panic_with_error!(&env, Error::OverMax);
        }
        let key = DataKey::Contribution(raise_id, investor.clone());
        let previous: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let total = previous + amount;
        if total < raise.terms.min_ticket {
            panic_with_error!(&env, Error::BelowMinimum);
        }
        check_eligible(&env, &config, &raise, &investor, total);
        if previous == 0 {
            count_holder(&env, &mut raise, &investor);
            raise.investors += 1;
        }

        token::TokenClient::new(&env, &config.usdc).transfer(
            &investor,
            &env.current_contract_address(),
            &amount,
        );
        set_persistent(&env, &key, &total);
        raise.raised += amount;
        save_raise(&env, &raise);
        Invested { raise_id, investor, amount, raised: raise.raised }.publish(&env);
    }

    /// Anyone can close a raise once it is full or past its deadline.
    /// Success pays the company everything raised; failure enables refunds.
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

        let succeeded = raise.raised >= raise.min_raise;
        if succeeded {
            token::TokenClient::new(&env, &config.usdc).transfer(
                &env.current_contract_address(),
                &raise.company,
                &raise.raised,
            );
            raise.state = RaiseState::Succeeded;
        } else {
            raise.state = RaiseState::Failed;
        }
        save_raise(&env, &raise);
        RaiseClosed { raise_id, succeeded, raised: raise.raised }.publish(&env);
        raise.state
    }

    /// After a successful raise, the investor receives their share tokens.
    /// This is the only place share tokens are ever minted. During lock-up
    /// they go straight into the dividend vault (earning from the next period)
    /// and the investor's wallet is frozen until `release`.
    pub fn claim_tokens(env: Env, raise_id: u32, investor: Address) -> i128 {
        investor.require_auth();
        let config = config(&env);
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
        let locked_up = env.ledger().timestamp() < raise.terms.lockup_until;
        if locked_up {
            VaultClient::new(&env, &config.vault).lock(&raise.token, &investor, &tokens);
            sac.set_authorized(&investor, &false);
            set_persistent(&env, &DataKey::LockupFrozen(raise_id, investor.clone()), &true);
        }
        TokensClaimed { raise_id, investor, tokens, locked_up }.publish(&env);
        tokens
    }

    /// After lock-up, a primary investor's lock-up freeze is lifted so they
    /// can unlock and trade with other eligible holders. Anyone can call it.
    pub fn release(env: Env, raise_id: u32, holder: Address) {
        let config = config(&env);
        let raise = load_raise(&env, raise_id);
        if env.ledger().timestamp() < raise.terms.lockup_until {
            panic_with_error!(&env, Error::LockedUp);
        }
        let frozen = DataKey::LockupFrozen(raise_id, holder.clone());
        if !env.storage().persistent().has(&frozen) {
            panic_with_error!(&env, Error::NothingToClaim);
        }
        check_eligible(&env, &config, &raise, &holder, 0);
        env.storage().persistent().remove(&frozen);
        token::StellarAssetClient::new(&env, &raise.token).set_authorized(&holder, &true);
        HolderAuthorized { token: raise.token, holder, authorized: true }.publish(&env);
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

    /// After lock-up, lets an investor eligible for the raise's exemption hold
    /// the token so they can buy it on the secondary market, within the
    /// holder cap.
    pub fn authorize_holder(env: Env, raise_id: u32, holder: Address) {
        holder.require_auth();
        let config = config(&env);
        let mut raise = load_raise(&env, raise_id);
        if env.ledger().timestamp() < raise.terms.lockup_until {
            panic_with_error!(&env, Error::LockedUp);
        }
        check_eligible(&env, &config, &raise, &holder, 0);
        count_holder(&env, &mut raise, &holder);
        save_raise(&env, &raise);
        let sac = token::StellarAssetClient::new(&env, &raise.token);
        sac.trust(&holder);
        sac.set_authorized(&holder, &true);
        HolderAuthorized { token: raise.token, holder, authorized: true }.publish(&env);
    }

    /// The raise's compliance account freezes a holder (e.g. they moved to
    /// the US, or a court order). The balance stays; transfers stop.
    pub fn freeze_holder(env: Env, raise_id: u32, holder: Address, reason: String) {
        let raise = load_raise(&env, raise_id);
        raise.terms.compliance.require_auth();
        require_reason(&env, &reason);
        token::StellarAssetClient::new(&env, &raise.token).set_authorized(&holder, &false);
        // A compliance freeze outlasts lock-up: `release` must not lift it.
        env.storage().persistent().remove(&DataKey::LockupFrozen(raise_id, holder.clone()));
        ComplianceAction { token: raise.token, holder, action: symbol_short!("freeze"), amount: 0, reason }.publish(&env);
    }

    /// The raise's compliance account lifts a freeze (not during lock-up).
    pub fn unfreeze_holder(env: Env, raise_id: u32, holder: Address, reason: String) {
        let raise = load_raise(&env, raise_id);
        raise.terms.compliance.require_auth();
        require_reason(&env, &reason);
        if env.ledger().timestamp() < raise.terms.lockup_until {
            panic_with_error!(&env, Error::LockedUp);
        }
        token::StellarAssetClient::new(&env, &raise.token).set_authorized(&holder, &true);
        ComplianceAction { token: raise.token, holder, action: symbol_short!("unfreeze"), amount: 0, reason }.publish(&env);
    }

    /// The raise's compliance account claws back (burns) tokens from a
    /// holder's wallet, for a court order, fraud, or a lost-key reissue.
    /// Tokens locked in the vault must be unlocked first.
    pub fn clawback(env: Env, raise_id: u32, holder: Address, amount: i128, reason: String) {
        let raise = load_raise(&env, raise_id);
        raise.terms.compliance.require_auth();
        require_reason(&env, &reason);
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidTerms);
        }
        token::StellarAssetClient::new(&env, &raise.token).clawback(&holder, &amount);
        ComplianceAction { token: raise.token, holder, action: symbol_short!("clawback"), amount, reason }.publish(&env);
    }

    /// The current compliance account hands the role on (e.g. to a transfer agent).
    pub fn set_raise_compliance(env: Env, raise_id: u32, new_compliance: Address) {
        let mut raise = load_raise(&env, raise_id);
        raise.terms.compliance.require_auth();
        raise.terms.compliance = new_compliance.clone();
        save_raise(&env, &raise);
        RoleChanged { role: symbol_short!("comply"), account: new_compliance, raise_id }.publish(&env);
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let mut c = config(&env);
        c.admin.require_auth();
        c.admin = new_admin.clone();
        env.storage().instance().set(&DataKey::Config, &c);
        RoleChanged { role: symbol_short!("admin"), account: new_admin, raise_id: 0 }.publish(&env);
    }

    /// The admin changes the flat listing fee for future raises.
    pub fn set_listing_fee(env: Env, listing_fee: i128) {
        let mut c = config(&env);
        c.admin.require_auth();
        if listing_fee < 0 {
            panic_with_error!(&env, Error::InvalidTerms);
        }
        c.listing_fee = listing_fee;
        env.storage().instance().set(&DataKey::Config, &c);
    }

    /// Whether `investor` meets the raise's exemption for a total of `amount`.
    pub fn is_eligible_for(env: Env, raise_id: u32, investor: Address, amount: i128) -> bool {
        eligible(&env, &config(&env), &load_raise(&env, raise_id), &investor, amount)
    }

    pub fn self_certification(env: Env, investor: Address) -> Option<Accreditation> {
        env.storage().persistent().get(&DataKey::SelfCertified(investor))
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

/// Reg S: a registered non-US residence proof. 506(c): a verifier's current
/// attestation, or a self-certification with the high minimum invested. The
/// combined exemption accepts either.
fn eligible(env: &Env, config: &Config, raise: &Raise, investor: &Address, amount: i128) -> bool {
    let resident = || GateClient::new(env, &config.gate).is_eligible(investor);
    match raise.terms.exemption {
        Exemption::RegS => resident(),
        Exemption::RegD506c => accredited(env, raise, investor, amount),
        Exemption::RegSAnd506c => resident() || accredited(env, raise, investor, amount),
    }
}

fn accredited(env: &Env, raise: &Raise, investor: &Address, amount: i128) -> bool {
    let now = env.ledger().timestamp();
    let attested = raise.terms.verifier.as_ref().is_some_and(|v| {
        env.storage()
            .persistent()
            .get::<_, u64>(&DataKey::Attested(v.clone(), investor.clone()))
            .is_some_and(|until| until > now)
    });
    attested
        || env
            .storage()
            .persistent()
            .get::<_, Accreditation>(&DataKey::SelfCertified(investor.clone()))
            .is_some_and(|a| amount >= if a.entity { ENTITY_SELF_CERTIFIED_MINIMUM } else { SELF_CERTIFIED_MINIMUM })
}

fn check_eligible(env: &Env, config: &Config, raise: &Raise, investor: &Address, amount: i128) {
    // A self-certified 506(c) holder who already met the minimum in the raise stays eligible.
    let met_minimum = raise.terms.exemption != Exemption::RegS
        && amount == 0
        && env.storage().persistent().has(&DataKey::Holder(raise.id, investor.clone()))
        && env.storage().persistent().has(&DataKey::SelfCertified(investor.clone()));
    if !met_minimum && !eligible(env, config, raise, investor, amount) {
        panic_with_error!(env, Error::NotEligible);
    }
}

/// Counts a new holder toward the cap (once per account).
fn count_holder(env: &Env, raise: &mut Raise, holder: &Address) {
    let key = DataKey::Holder(raise.id, holder.clone());
    if env.storage().persistent().has(&key) {
        return;
    }
    if raise.holders >= raise.terms.max_holders {
        panic_with_error!(env, Error::HolderCap);
    }
    raise.holders += 1;
    set_persistent(env, &key, &true);
}

fn require_reason(env: &Env, reason: &String) {
    if reason.len() == 0 {
        panic_with_error!(env, Error::InvalidTerms);
    }
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
