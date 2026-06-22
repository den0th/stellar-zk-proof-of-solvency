#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    crypto::bls12_381::{Fr, G1Affine, G2Affine},
    symbol_short, vec, Env, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Groth16Error {
    MalformedVerifyingKey = 0,
    VkNotSet = 1,
    VerificationFailed = 2,
}

#[derive(Clone)]
#[contracttype]
pub struct VerificationKey {
    pub alpha: G1Affine,
    pub beta: G2Affine,
    pub gamma: G2Affine,
    pub delta: G2Affine,
    pub ic: Vec<G1Affine>,
}

#[derive(Clone)]
#[contracttype]
pub struct Proof {
    pub a: G1Affine,
    pub b: G2Affine,
    pub c: G1Affine,
}

#[derive(Clone)]
#[contracttype]
pub enum SolvencyStatus {
    Solvent,
}

// A recorded, timestamped solvency attestation. `root_hash` is the public Poseidon-MST
// commitment to the balance set; `threshold` is the public solvency ceiling T. An
// attestation exists ONLY because a real proof (liabilities sum <= T) verified on-chain.
#[derive(Clone)]
#[contracttype]
pub struct Attestation {
    pub id: u32,
    pub root_hash: Fr,
    pub threshold: Fr,
    pub ledger_timestamp: u64,
    pub status: SolvencyStatus,
}

#[contracttype]
pub enum DataKey {
    Vk,
    Count,
    Attestation(u32),
}

#[contract]
pub struct Groth16Verifier;

#[contractimpl]
impl Groth16Verifier {
    // Pure verifier (unchanged from the official soroban-examples groth16_verifier).
    pub fn verify_proof(
        env: Env,
        vk: VerificationKey,
        proof: Proof,
        pub_signals: Vec<Fr>,
    ) -> Result<bool, Groth16Error> {
        let bls = env.crypto().bls12_381();

        // Prepare proof inputs:
        // Compute vk_x = ic[0] + sum(pub_signals[i] * ic[i+1])
        if pub_signals.len() + 1 != vk.ic.len() {
            return Err(Groth16Error::MalformedVerifyingKey);
        }
        let mut vk_x = vk.ic.get(0).unwrap();
        for (s, v) in pub_signals.iter().zip(vk.ic.iter().skip(1)) {
            let prod = bls.g1_mul(&v, &s);
            vk_x = bls.g1_add(&vk_x, &prod);
        }

        // Compute the pairing:
        // e(-A, B) * e(alpha, beta) * e(vk_x, gamma) * e(C, delta) == 1
        let neg_a = -proof.a;
        let vp1 = vec![&env, neg_a, vk.alpha, vk_x, proof.c];
        let vp2 = vec![&env, proof.b, vk.beta, vk.gamma, vk.delta];

        Ok(bls.pairing_check(vp1, vp2))
    }

    // Store the verification key once (deploy-time). Kept simple for the demo (no admin gate):
    // a production version would require an admin Address with require_auth().
    pub fn set_vk(env: Env, vk: VerificationKey) {
        env.storage().instance().set(&DataKey::Vk, &vk);
    }

    // Verify a solvency proof against the stored vk and, IFF it verifies, record a timestamped
    // attestation and emit an event. A failing proof reverts (VerificationFailed) and writes nothing.
    // pub_signals = [rootHash, threshold] (snarkjs order: public output then public input).
    pub fn verify_and_attest(
        env: Env,
        proof: Proof,
        pub_signals: Vec<Fr>,
    ) -> Result<Attestation, Groth16Error> {
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&DataKey::Vk)
            .ok_or(Groth16Error::VkNotSet)?;

        let ok = Self::verify_proof(env.clone(), vk, proof, pub_signals.clone())?;
        if !ok {
            return Err(Groth16Error::VerificationFailed);
        }

        let root_hash = pub_signals.get(0).ok_or(Groth16Error::MalformedVerifyingKey)?;
        let threshold = pub_signals.get(1).ok_or(Groth16Error::MalformedVerifyingKey)?;

        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let att = Attestation {
            id: count,
            root_hash,
            threshold,
            ledger_timestamp: env.ledger().timestamp(),
            status: SolvencyStatus::Solvent,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Attestation(count), &att);
        env.storage().instance().set(&DataKey::Count, &(count + 1));
        env.events()
            .publish((symbol_short!("solvency"), symbol_short!("attest")), att.clone());
        Ok(att)
    }

    pub fn get_attestation(env: Env, id: u32) -> Option<Attestation> {
        env.storage().persistent().get(&DataKey::Attestation(id))
    }

    pub fn latest(env: Env) -> Option<Attestation> {
        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        if count == 0 {
            return None;
        }
        env.storage().persistent().get(&DataKey::Attestation(count - 1))
    }
}

mod test;
mod test_solvency;
