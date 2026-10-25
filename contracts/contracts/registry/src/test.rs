#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, BytesN, Env, String};

fn setup() -> (Env, RegistryClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(Registry, (admin.clone(),));
    (env.clone(), RegistryClient::new(&env, &id), admin)
}

#[test]
fn full_lifecycle() {
    let (env, reg, _admin) = setup();
    let owner = Address::generate(&env);
    let id = reg.register(
        &owner,
        &String::from_str(&env, "Andes Craft Brewing"),
        &152,
        &String::from_str(&env, "https://example.com/andes.json"),
    );
    assert_eq!(id, 1);
    assert_eq!(reg.owner_if_active(&id), None);

    reg.verify(&id, &BytesN::from_array(&env, &[1; 32]));
    assert_eq!(reg.owner_if_active(&id), None);

    reg.sign_agreement(&id, &BytesN::from_array(&env, &[2; 32]), &5_000, &31_536_000);
    assert_eq!(reg.owner_if_active(&id), Some(owner));
    let c = reg.company(&id);
    assert_eq!(c.status, Status::Active);
    assert_eq!(c.payout_bps, 5_000);
    assert_eq!(reg.count(), 1);
}

#[test]
fn cannot_sign_before_verification() {
    let (env, reg, _admin) = setup();
    let owner = Address::generate(&env);
    let id = reg.register(&owner, &String::from_str(&env, "X"), &620, &String::from_str(&env, ""));
    let res = reg.try_sign_agreement(&id, &BytesN::from_array(&env, &[2; 32]), &5_000, &1);
    assert_eq!(res, Err(Ok(soroban_sdk::Error::from_contract_error(Error::NotVerified as u32))));
}

#[test]
fn rejects_invalid_payout() {
    let (env, reg, _admin) = setup();
    let owner = Address::generate(&env);
    let id = reg.register(&owner, &String::from_str(&env, "X"), &620, &String::from_str(&env, ""));
    reg.verify(&id, &BytesN::from_array(&env, &[1; 32]));
    let res = reg.try_sign_agreement(&id, &BytesN::from_array(&env, &[2; 32]), &10_001, &1);
    assert_eq!(res, Err(Ok(soroban_sdk::Error::from_contract_error(Error::InvalidPayout as u32))));
}
