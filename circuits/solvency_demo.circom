pragma circom 2.0.0;

// Day-3b: N=8 Merkle-Sum-Tree Proof-of-Solvency on BLS12-381.
// Commits to the exact 8-balance multiset via a Poseidon-MST rootHash (PUBLIC OUTPUT)
// AND proves rootSum <= threshold (PUBLIC INPUT). A valid proof exists IFF the 8
// private balances hash to rootHash AND their sum <= T.
//
// CRITICAL: Poseidon255 from poseidon-bls12381-circom uses the CORRECT BLS12-381
// constants (verified: Poseidon255(2)([1,2]) == 0x3fb8310b...e08e5fa, the package's
// known-answer vector). Do NOT include circomlib's poseidon.circom (BN254 constants).
// NOTE: the Poseidon255 template's input signal is named `in` (NOT `inputs`).

include "poseidon255.circom";        // -l node_modules/poseidon-bls12381-circom/circuits
include "bitify.circom";             // Num2Bits  (circomlib, field-agnostic on bls12381)
include "comparators.circom";        // LessThan  (circomlib, field-agnostic on bls12381)

// 0 <= x < 2^bits ; kills negatives (field-wrap) and overflow.
template RangeCheck(bits) {
    signal input in;
    component n2b = Num2Bits(bits);
    n2b.in <== in;
}

// Summa-style safe a <= b for n-bit numbers (both range-checked).
template SafeLessEqThan(n) {
    assert(n <= 252);
    signal input in[2];
    signal output out;
    component aR = Num2Bits(n); aR.in <== in[0];
    component bR = Num2Bits(n); bR.in <== in[1];
    component lt = LessThan(n);
    lt.in[0] <== in[0];
    lt.in[1] <== in[1] + 1;          // a <= b  <=>  a < b + 1
    out <== lt.out;
}

// leaf = Poseidon255(saltedUser, balance); balance range-checked to 64 bits.
template Leaf() {
    signal input user;              // salted username/id (field element)
    signal input balance;          // 0 <= balance < 2^64
    signal output hash;
    signal output sum;
    component rc = RangeCheck(64); rc.in <== balance;
    component h = Poseidon255(2);
    h.in[0] <== user;               // template signal is `in`, not `inputs`
    h.in[1] <== balance;
    hash <== h.out;
    sum  <== balance;
}

// inner node: parentHash = Poseidon255(lHash,lSum,rHash,rSum); parentSum = lSum+rSum.
// Binding BOTH hash AND sum at every level prevents swapping a smaller sum under a real hash.
template Node() {
    signal input lHash; signal input lSum;
    signal input rHash; signal input rSum;
    signal output hash;
    signal output sum;
    component h = Poseidon255(4);
    h.in[0] <== lHash;
    h.in[1] <== lSum;
    h.in[2] <== rHash;
    h.in[3] <== rSum;
    hash <== h.out;
    // 8 leaves * (2^64-1) < 2^67 << r (~2^254.8): cannot wrap.
    sum  <== lSum + rSum;
}

// FIXED depth-3 over 8 leaves. Public signals: [rootHash (output), threshold (input)].
template Solvency8() {
    signal output rootHash;         // PUBLIC OUTPUT (commitment) -> public.json index 0
    signal input  threshold;        // PUBLIC INPUT  (asset cap)  -> public.json index 1

    signal input users[8];          // PRIVATE
    signal input balances[8];       // PRIVATE

    // level 0: 8 leaves
    component L[8];
    for (var i = 0; i < 8; i++) {
        L[i] = Leaf();
        L[i].user    <== users[i];
        L[i].balance <== balances[i];
    }
    // level 1: 4 nodes
    component N1[4];
    for (var i = 0; i < 4; i++) {
        N1[i] = Node();
        N1[i].lHash <== L[2*i].hash;   N1[i].lSum <== L[2*i].sum;
        N1[i].rHash <== L[2*i+1].hash; N1[i].rSum <== L[2*i+1].sum;
    }
    // level 2: 2 nodes
    component N2[2];
    for (var i = 0; i < 2; i++) {
        N2[i] = Node();
        N2[i].lHash <== N1[2*i].hash;   N2[i].lSum <== N1[2*i].sum;
        N2[i].rHash <== N1[2*i+1].hash; N2[i].rSum <== N1[2*i+1].sum;
    }
    // level 3: root
    component R = Node();
    R.lHash <== N2[0].hash; R.lSum <== N2[0].sum;
    R.rHash <== N2[1].hash; R.rSum <== N2[1].sum;

    // expose computed root as the public commitment
    rootHash <== R.hash;

    // solvency: rootSum (total liabilities) <= threshold (total assets / cap)
    component le = SafeLessEqThan(252);
    le.in[0] <== R.sum;
    le.in[1] <== threshold;
    le.out === 1;
}

// public-signal order is [rootHash, threshold]: output first, then declared public input.
component main {public [threshold]} = Solvency8();
