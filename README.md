# ZK Proof-of-Solvency on Stellar

A zero-knowledge **proof-of-solvency**: a custodian or asset issuer proves ON-CHAIN that its total
liabilities (the sum of every customer balance) are at most a public threshold `T`, **without revealing
any individual balance or the exact total**. Built for "Stellar Hacks: Real-World ZK" (SDF / DoraHacks).

Post-FTX, exchanges and stablecoin/RWA issuers are expected to prove reserves cover liabilities. Doing
that publicly leaks every customer's balance. This shows the privacy-preserving alternative, verified by a
Soroban smart contract on Stellar.

## Why the ZK is load-bearing

A plain Merkle-sum proof leaks sibling balances and partial sums. Here the SNARK proves, over data the
chain never sees:

1. eight private balances each lie in `[0, 2^64)` (range checks block negative or field-wrap fakery),
2. they hash, via a Poseidon Merkle-Sum-Tree, to a public commitment `rootHash`,
3. their summed total is `<= threshold`.

The contract's pass/fail (and the attestation it records) depends entirely on a proof over private inputs.
Remove the ZK and the feature is impossible.

## Architecture

```
  off-chain (private)                         on-chain (Soroban / Stellar)
  +--------------------------+                +-----------------------------------+
  | 8 private balances        |   Groth16     | groth16-verifier contract          |
  |  -> Poseidon-MST (BLS12-  |   proof  +    |  verify_proof(vk, proof, [root,T]) |
  |     381) -> rootHash       |  public:      |   -> BLS12-381 pairing check       |
  |  -> prove sum <= T         |  [rootHash,T] |  verify_and_attest(...)            |
  |  (circom + snarkjs)        | ===========>  |   -> Attestation{root,T,ts,Solvent}|
  +--------------------------+                |      stored + event emitted         |
                                              +-----------------------------------+
```

- **Circuit** (`circuits/solvency_demo.circom`): Circom 2.x, `Poseidon255` over **BLS12-381** (from
  `poseidon-bls12381-circom`), `RangeCheck(64)` per balance, `SafeLessEqThan(252)` on the sum, public
  signals `[rootHash, threshold]`.
- **Verifier contract** (`contracts/groth16-verifier/`): the official `soroban-examples/groth16_verifier`
  (BLS12-381 pairing via `env.crypto().bls12_381()`) plus an attestation layer: `set_vk`,
  `verify_and_attest`, `get_attestation`, `latest`. On a verifying proof it records a timestamped
  `Attestation{ root_hash, threshold, ledger_timestamp, status: Solvent }` and emits a `(solvency, attest)`
  event. A failing proof reverts and writes nothing.

## What is proven vs mocked (read this)

Honesty is a judging criterion here, so the boundaries are explicit:

- **PROVEN (real ZK, verified on-chain):** knowledge of 8 private balances that (a) are each in range,
  (b) hash to the public `rootHash`, and (c) sum to `<= threshold`. A tampered proof or a wrong public
  input (`threshold` or `rootHash`) is rejected on-chain. An **insolvent** prover (`sum > threshold`)
  cannot even generate a witness, so cannot produce a proof at all.
- **MOCKED / attested (disclosed):**
  - Balances are a fixed synthetic 8-entry set (no real customer data).
  - **Proof-of-assets is attested, not proven.** We prove liabilities `<= threshold`; we do NOT
    cryptographically prove the issuer actually holds `threshold` in reserves. A full system pairs this
    with a proof-of-assets (signed/on-chain reserve attestations).
  - The trusted setup is a **toy single-party** powers-of-tau + phase-2 contribution (the entropy holder
    could forge proofs). A production system needs a multi-party ceremony.
  - Fixed `N = 8`, depth-3 tree, single asset. This is a whole-tree commitment, not a per-user inclusion
    proof. `rootHash` binds the exact 8-balance multiset, not that the set is the complete/deduped
    liability set (an off-chain attestation concern).
  - The verifier contract is the upstream example ("demonstration only, not audited") plus a thin
    attestation layer. No production-solvency guarantees are claimed.

## Reproduce

Prerequisites: Rust (rustup stable) with `wasm32v1-none`, the `stellar` CLI, Node.js, and `circom`
(`cargo install --git https://github.com/iden3/circom`).

```bash
# 1. Generate the BLS12-381 Groth16 artifacts (compile -> toy setup -> prove -> local verify).
cd circuits && ./build.sh        # ends with: snarkJS: OK!  =>  == DONE ==
cp build/proof.json build/verification_key.json build/public.json \
   ../contracts/groth16-verifier/data/solvency/

# 2. Build the Soroban contract + verify on-chain (local Env): PASS + tamper-REJECT + attestation.
cd .. && stellar contract build  # => Build Complete
cargo test -p groth16-verifier   # => test result: ok. 3 passed; 0 failed
```

Insolvency cannot be faked:

```bash
cd circuits
node build/solvency_demo_js/generate_witness.js \
  build/solvency_demo_js/solvency_demo.wasm input_insolvent.json /tmp/bad.wtns
# => Error: Assert Failed (Solvency8, le.out === 1) ; no witness produced
```

## Verification discipline

The repo carries a self-improving `verify-soroban` skill (`.claude/skills/`) whose ZK green-gate is the
rule used here: a change is "verified" only when, in the same run, a **real proof verifies on-chain** AND
a **tampered/insolvent input is rejected**, both observed. Showing only the pass is treated as a green lie.

## Credits / provenance

- `soroban-examples/groth16_verifier` (Stellar Development Foundation) for the BLS12-381 verifier core.
- `jamesbachini/CircomStellar` for the Circom to Soroban proving pipeline reference.
- `summa-dev` (Summa-Solvency) for the Merkle-Sum-Tree proof-of-solvency design.
- `poseidon-bls12381-circom` for BLS12-381 Poseidon constants (`Poseidon255`).

## Disclaimer

Experimental, unaudited, demonstration only. Toy trusted setup. Not for production use.
