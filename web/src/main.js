import * as snarkjs from "snarkjs";
import { requestAccess, signTransaction } from "@stellar/freighter-api";
import { Client, networks } from "./bindings";
import { g1, g2 } from "./encode";

const RPC = "https://soroban-testnet.stellar.org";
const $ = (id) => document.getElementById(id);
const setStatus = (m) => { $("status").textContent = m; };
let address = null;

// 8 private balance inputs
const grid = $("balances");
for (let i = 0; i < 8; i++) {
  const inp = document.createElement("input");
  inp.id = "b" + i;
  inp.value = "10";
  inp.inputMode = "numeric";
  grid.appendChild(inp);
}

$("connect").onclick = async () => {
  try {
    const r = await requestAccess();
    if (r.error) throw new Error(r.error);
    address = r.address;
    $("connect").textContent = `Connected ${address.slice(0, 5)}...${address.slice(-4)}`;
    $("attest").disabled = false;
  } catch (e) {
    setStatus("Freighter: " + (e.message || e) + " (install the extension and fund a testnet account)");
  }
};

$("attest").onclick = async () => {
  $("attest").disabled = true;
  $("result").replaceChildren();
  try {
    const balances = Array.from({ length: 8 }, (_, i) => ($("b" + i).value || "0").trim());
    const threshold = ($("threshold").value || "0").trim();
    const input = { threshold, users: ["1", "2", "3", "4", "5", "6", "7", "8"], balances };

    setStatus("Generating the proof in your browser (a few seconds; balances stay local)...");
    let proof, publicSignals;
    try {
      ({ proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "solvency_demo.wasm",
        "solvency_final.zkey"
      ));
    } catch (_) {
      // an insolvent set (sum > threshold) violates the circuit and cannot produce a witness
      setStatus("No proof: your balances sum exceeds the threshold (insolvent). The circuit cannot lie about solvency.");
      return;
    }

    setStatus("Proof generated. Submitting verify_and_attest to Stellar testnet (approve in Freighter)...");
    const client = new Client({
      ...networks.testnet,
      rpcUrl: RPC,
      publicKey: address,
      signTransaction: async (xdr) => {
        const res = await signTransaction(xdr, {
          networkPassphrase: networks.testnet.networkPassphrase,
          address,
        });
        if (res.error) throw new Error(res.error);
        return res; // { signedTxXdr, signerAddress }
      },
    });

    const tx = await client.verify_and_attest({
      proof: { a: g1(proof.pi_a), b: g2(proof.pi_b), c: g1(proof.pi_c) },
      pub_signals: publicSignals.map((s) => BigInt(s)),
    });
    const sent = await tx.signAndSend();
    const att = sent.result && sent.result.unwrap ? sent.result.unwrap() : sent.result;

    setStatus(`Solvent. On-chain attestation #${att.id} recorded.`);
    // safe DOM construction (no innerHTML): root_hash is numeric, contractId is a constant
    const code = document.createElement("code");
    code.textContent = att.root_hash.toString().slice(0, 24) + "...";
    const link = document.createElement("a");
    link.target = "_blank";
    link.href = `https://stellar.expert/explorer/testnet/contract/${networks.testnet.contractId}`;
    link.textContent = "view contract on stellar.expert";
    $("result").replaceChildren(document.createTextNode("rootHash "), code, document.createTextNode(" · "), link);
  } catch (e) {
    setStatus("Error: " + (e.message || e));
  } finally {
    $("attest").disabled = false;
  }
};
