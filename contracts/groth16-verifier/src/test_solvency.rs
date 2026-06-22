#![cfg(test)]
extern crate std;

// On-chain (local Env) verification of OUR OWN N=8 Merkle-Sum-Tree solvency proof, plus the
// attestation layer. Artifacts produced by circuits/build.sh (regenerate => recopy => recompile
// = pinned together). Public signals = [rootHash, threshold] (snarkjs: output first, then input).
// ZK green-gate: a real proof PASSES (and records an attestation), tampered public signals are
// REJECTED (and record nothing). No testnet — proven locally.

use ark_bls12_381::{Fq, Fq2};
use ark_ff::{BigInteger, PrimeField};
use ark_serialize::CanonicalSerialize;
use core::str::FromStr;
use soroban_sdk::{
    crypto::bls12_381::{Fr, G1Affine, G2Affine, G1_SERIALIZED_SIZE, G2_SERIALIZED_SIZE},
    Bytes, Env, Vec, U256,
};

use crate::{Groth16Verifier, Groth16VerifierClient, Proof, SolvencyStatus, VerificationKey};

const VK_JSON: &str = include_str!("../data/solvency/verification_key.json");
const PROOF_JSON: &str = include_str!("../data/solvency/proof.json");
const PUBLIC_JSON: &str = include_str!("../data/solvency/public.json");

fn g1_from_coords(env: &Env, x: &str, y: &str) -> G1Affine {
    let ark_g1 = ark_bls12_381::G1Affine::new(Fq::from_str(x).unwrap(), Fq::from_str(y).unwrap());
    let mut buf = [0u8; G1_SERIALIZED_SIZE];
    ark_g1.serialize_uncompressed(&mut buf[..]).unwrap();
    G1Affine::from_array(env, &buf)
}

fn g2_from_coords(env: &Env, x1: &str, x2: &str, y1: &str, y2: &str) -> G2Affine {
    let x = Fq2::new(Fq::from_str(x1).unwrap(), Fq::from_str(x2).unwrap());
    let y = Fq2::new(Fq::from_str(y1).unwrap(), Fq::from_str(y2).unwrap());
    let ark_g2 = ark_bls12_381::G2Affine::new(x, y);
    let mut buf = [0u8; G2_SERIALIZED_SIZE];
    ark_g2.serialize_uncompressed(&mut buf[..]).unwrap();
    G2Affine::from_array(env, &buf)
}

fn g1_json(env: &Env, v: &serde_json::Value) -> G1Affine {
    g1_from_coords(env, v[0].as_str().unwrap(), v[1].as_str().unwrap())
}

// snarkjs G2 = [[x_c0, x_c1], [y_c0, y_c1], [..]]  ->  Fq2(x_c0, x_c1), Fq2(y_c0, y_c1)
fn g2_json(env: &Env, v: &serde_json::Value) -> G2Affine {
    g2_from_coords(
        env,
        v[0][0].as_str().unwrap(),
        v[0][1].as_str().unwrap(),
        v[1][0].as_str().unwrap(),
        v[1][1].as_str().unwrap(),
    )
}

// Big BLS12-381 scalar (e.g. a Poseidon rootHash, ~77 digits) -> Soroban Fr.
fn fr_from_decimal(env: &Env, dec: &str) -> Fr {
    let ark_fr = ark_bls12_381::Fr::from_str(dec).expect("invalid Fr decimal");
    let be = ark_fr.into_bigint().to_bytes_be(); // <= 32 bytes, big-endian, already < r
    let mut buf = [0u8; 32];
    buf[32 - be.len()..].copy_from_slice(&be); // left-pad minimal-length to fixed 32
    let bytes = Bytes::from_array(env, &buf);
    let u = U256::from_be_bytes(env, &bytes);
    Fr::from_u256(u)
}

// Load vk + proof + the parsed public.json from the pinned artifacts.
fn load(env: &Env) -> (VerificationKey, Proof, serde_json::Value) {
    let vk_v: serde_json::Value = serde_json::from_str(VK_JSON).unwrap();
    let proof_v: serde_json::Value = serde_json::from_str(PROOF_JSON).unwrap();
    let pub_v: serde_json::Value = serde_json::from_str(PUBLIC_JSON).unwrap();

    let mut ic = Vec::new(env);
    for p in vk_v["IC"].as_array().unwrap() {
        ic.push_back(g1_json(env, p));
    }
    let vk = VerificationKey {
        alpha: g1_json(env, &vk_v["vk_alpha_1"]),
        beta: g2_json(env, &vk_v["vk_beta_2"]),
        gamma: g2_json(env, &vk_v["vk_gamma_2"]),
        delta: g2_json(env, &vk_v["vk_delta_2"]),
        ic,
    };
    let proof = Proof {
        a: g1_json(env, &proof_v["pi_a"]),
        b: g2_json(env, &proof_v["pi_b"]),
        c: g1_json(env, &proof_v["pi_c"]),
    };
    (vk, proof, pub_v)
}

// Build pub_signals by iterating public.json IN ARRAY ORDER (must match the verifier's Vec<Fr>).
fn good_signals(env: &Env, pub_v: &serde_json::Value) -> Vec<Fr> {
    let mut v = Vec::new(env);
    for s in pub_v.as_array().unwrap() {
        v.push_back(fr_from_decimal(env, s.as_str().unwrap()));
    }
    v
}

#[test]
fn solvency_demo_proof_verifies_onchain() {
    let env = Env::default();
    let (vk, proof, pub_v) = load(&env);
    let arr = pub_v.as_array().unwrap();
    let client = Groth16VerifierClient::new(&env, &env.register(Groth16Verifier {}, ()));

    // POSITIVE: real [rootHash, threshold] verifies on-chain.
    let good = good_signals(&env, &pub_v);
    assert_eq!(client.verify_proof(&vk, &proof, &good), true);

    // NEGATIVE 1: tampered THRESHOLD (real rootHash, 99) -> rejected.
    let mut bad_threshold = Vec::new(&env);
    bad_threshold.push_back(fr_from_decimal(&env, arr[0].as_str().unwrap()));
    bad_threshold.push_back(fr_from_decimal(&env, "99"));
    assert_eq!(client.verify_proof(&vk, &proof, &bad_threshold), false);

    // NEGATIVE 2: tampered ROOTHASH (commitment binds) -> rejected.
    let mut bad_root = Vec::new(&env);
    bad_root.push_back(fr_from_decimal(&env, "1"));
    bad_root.push_back(fr_from_decimal(&env, arr[1].as_str().unwrap()));
    assert_eq!(client.verify_proof(&vk, &proof, &bad_root), false);
}

#[test]
fn verify_and_attest_records_attestation() {
    let env = Env::default();
    let (vk, proof, pub_v) = load(&env);
    let arr = pub_v.as_array().unwrap();
    let client = Groth16VerifierClient::new(&env, &env.register(Groth16Verifier {}, ()));

    // deploy-time: store the verification key.
    client.set_vk(&vk);

    // PASS: real proof -> a timestamped Solvent attestation is recorded.
    let good = good_signals(&env, &pub_v);
    let att = client.verify_and_attest(&proof, &good);
    assert_eq!(att.id, 0);
    assert!(matches!(att.status, SolvencyStatus::Solvent));
    assert_eq!(client.latest().unwrap().id, 0);
    assert!(client.get_attestation(&0).is_some());

    // REJECT: tampered threshold -> NOT attested (no Ok(Ok(_))), and nothing new is recorded.
    let mut bad_threshold = Vec::new(&env);
    bad_threshold.push_back(fr_from_decimal(&env, arr[0].as_str().unwrap()));
    bad_threshold.push_back(fr_from_decimal(&env, "99"));
    match client.try_verify_and_attest(&proof, &bad_threshold) {
        Ok(Ok(_)) => panic!("tampered proof must NOT produce an attestation"),
        _ => {} // Ok(Err(..)) or Err(..) both mean rejected
    }
    assert_eq!(client.latest().unwrap().id, 0); // still only the first attestation
}
