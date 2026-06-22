# Demo script (2-3 min)

Screen-record, narrate. Goal: show a real ZK proof-of-solvency verified on Stellar, honestly bounded.
All commands run from the repo root unless noted. `export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:$PATH"`.

## 0:00 - 0:25  The problem
Say: "After FTX, a custodian must prove its reserves cover customer liabilities, but publishing every
balance doxxes customers. Here is the zero-knowledge alternative, verified on Stellar."
Show: `circuits/input.json` (8 private balances) and note only `[rootHash, threshold]` go public.

## 0:25 - 1:10  Off-chain: generate the proof
Run:
```bash
cd circuits && ./build.sh
```
Point at: the circuit compiling on BLS12-381, the Groth16 prove step, and the final `snarkJS: OK!`.
Say: "Balances never leave the laptop. The circuit hashes them into a Poseidon Merkle-Sum-Tree commitment
(rootHash) and proves their sum is at most the public threshold." Show `build/public.json` = `[rootHash, 100]`.

## 1:10 - 2:00  On-chain: verify + attest
Run:
```bash
cd .. && cargo test -p groth16-verifier -- --nocapture
```
Point at: `test result: ok. 3 passed`. Say: "The Soroban contract runs the BLS12-381 pairing check on the
proof against the public rootHash and threshold. On success it records a timestamped Solvent attestation."
(If deployed: show the testnet contract ID + the `verify_and_attest` tx + `latest` returning the attestation.)

## 2:00 - 2:40  You cannot lie
Run:
```bash
cd circuits && node build/solvency_demo_js/generate_witness.js \
  build/solvency_demo_js/solvency_demo.wasm input_insolvent.json /tmp/bad.wtns
```
Point at: `Error: Assert Failed` and that no witness is produced. Say: "An insolvent set (sum > threshold)
cannot even produce a witness, so no proof exists. And a tampered proof or wrong public input is rejected
on-chain (the REJECT cases in the test)."

## 2:40 - end  Honesty + close
Say: "What is real: the ZK solvency proof verified on Stellar. What is mocked and disclosed in the README:
synthetic balances, a toy single-party setup, and the asset side is attested not proven. Full repo and an
honest README in CI." Show the README "What is proven vs mocked" section.

## Talking points (if asked)
- BLS12-381 Poseidon (poseidon-bls12381-circom), not circomlib's BN254 instance (that would be the wrong field).
- The commitment binds: changing the rootHash makes the on-chain verify reject.
- The verifier is the official soroban-examples groth16_verifier plus a thin attestation layer.
