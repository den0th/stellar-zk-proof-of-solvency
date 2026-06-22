#!/usr/bin/env bash
# Reproducible BLS12-381 Groth16 pipeline for the N=8 Merkle-Sum-Tree solvency circuit.
# Poseidon255 = poseidon-bls12381-circom@1.0.0 (CORRECT BLS12-381 constants; NOT circomlib's BN254 Poseidon).
# Toy SINGLE-PARTY trusted setup (non-ceremonial) — disclosed; fine for demo, not production.
# circom required (cargo install --git https://github.com/iden3/circom); snarkjs+circomlib+poseidon via npm.
set -euo pipefail
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")"
mkdir -p build

[ -d node_modules/poseidon-bls12381-circom ] || npm install --silent --no-audit --no-fund circomlib snarkjs poseidon-bls12381-circom@1.0.0
POSEIDON=node_modules/poseidon-bls12381-circom/circuits
CIRCOMLIB=node_modules/circomlib/circuits

echo "== compile (BLS12-381, Poseidon255 + circomlib) =="
circom solvency_demo.circom --r1cs --wasm --sym --prime bls12381 -l "$POSEIDON" -l "$CIRCOMLIB" -o build

echo "== powers of tau (bls12381, power 14, toy single-party) =="
npx --yes snarkjs powersoftau new bls12381 14 build/pot_0000.ptau
npx --yes snarkjs powersoftau contribute build/pot_0000.ptau build/pot_0001.ptau --name="toy" -e="stellar-lab day3 entropy"
npx --yes snarkjs powersoftau prepare phase2 build/pot_0001.ptau build/pot_final.ptau

echo "== groth16 setup + zkey =="
npx --yes snarkjs groth16 setup build/solvency_demo.r1cs build/pot_final.ptau build/solvency_0000.zkey
npx --yes snarkjs zkey contribute build/solvency_0000.zkey build/solvency_final.zkey --name="toy2" -e="more day3 entropy"
npx --yes snarkjs zkey export verificationkey build/solvency_final.zkey build/verification_key.json

echo "== witness + prove + LOCAL verify =="
node build/solvency_demo_js/generate_witness.js build/solvency_demo_js/solvency_demo.wasm input.json build/witness.wtns
npx --yes snarkjs groth16 prove build/solvency_final.zkey build/witness.wtns build/proof.json build/public.json
npx --yes snarkjs groth16 verify build/verification_key.json build/public.json build/proof.json
echo "== DONE =="
