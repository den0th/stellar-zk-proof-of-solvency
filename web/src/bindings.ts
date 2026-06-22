import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CDCNXZ7JGDBOFEYM44GX2OA6L7ULMW4D2JDY5SCCNS4LO6VW7SOKBZQQ",
  }
} as const


export interface Proof {
  a: Buffer;
  b: Buffer;
  c: Buffer;
}

export type DataKey = {tag: "Vk", values: void} | {tag: "Count", values: void} | {tag: "Attestation", values: readonly [u32]};


export interface Attestation {
  id: u32;
  ledger_timestamp: u64;
  root_hash: u256;
  status: SolvencyStatus;
  threshold: u256;
}

export const Groth16Error = {
  0: {message:"MalformedVerifyingKey"},
  1: {message:"VkNotSet"},
  2: {message:"VerificationFailed"},
  3: {message:"VkAlreadySet"}
}

export type SolvencyStatus = {tag: "Solvent", values: void};


export interface VerificationKey {
  alpha: Buffer;
  beta: Buffer;
  delta: Buffer;
  gamma: Buffer;
  ic: Array<Buffer>;
}

export interface Client {
  /**
   * Construct and simulate a latest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  latest: (options?: MethodOptions) => Promise<AssembledTransaction<Option<Attestation>>>

  /**
   * Construct and simulate a set_vk transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_vk: ({vk}: {vk: VerificationKey}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a verify_proof transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  verify_proof: ({vk, proof, pub_signals}: {vk: VerificationKey, proof: Proof, pub_signals: Array<u256>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<boolean>>>

  /**
   * Construct and simulate a get_attestation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_attestation: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Attestation>>>

  /**
   * Construct and simulate a verify_and_attest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  verify_and_attest: ({proof, pub_signals}: {proof: Proof, pub_signals: Array<u256>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Attestation>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABVByb29mAAAAAAAAAwAAAAAAAAABYQAAAAAAA+4AAABgAAAAAAAAAAFiAAAAAAAD7gAAAMAAAAAAAAAAAWMAAAAAAAPuAAAAYA==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAwAAAAAAAAAAAAAAAlZrAAAAAAAAAAAAAAAAAAVDb3VudAAAAAAAAAEAAAAAAAAAC0F0dGVzdGF0aW9uAAAAAAEAAAAE",
        "AAAAAQAAAAAAAAAAAAAAC0F0dGVzdGF0aW9uAAAAAAUAAAAAAAAAAmlkAAAAAAAEAAAAAAAAABBsZWRnZXJfdGltZXN0YW1wAAAABgAAAAAAAAAJcm9vdF9oYXNoAAAAAAAADAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADlNvbHZlbmN5U3RhdHVzAAAAAAAAAAAACXRocmVzaG9sZAAAAAAAAAw=",
        "AAAABAAAAAAAAAAAAAAADEdyb3RoMTZFcnJvcgAAAAQAAAAAAAAAFU1hbGZvcm1lZFZlcmlmeWluZ0tleQAAAAAAAAAAAAAAAAAACFZrTm90U2V0AAAAAQAAAAAAAAASVmVyaWZpY2F0aW9uRmFpbGVkAAAAAAACAAAAAAAAAAxWa0FscmVhZHlTZXQAAAAD",
        "AAAAAgAAAAAAAAAAAAAADlNvbHZlbmN5U3RhdHVzAAAAAAABAAAAAAAAAAAAAAAHU29sdmVudAA=",
        "AAAAAAAAAAAAAAAGbGF0ZXN0AAAAAAAAAAAAAQAAA+gAAAfQAAAAC0F0dGVzdGF0aW9uAA==",
        "AAAAAAAAAAAAAAAGc2V0X3ZrAAAAAAABAAAAAAAAAAJ2awAAAAAH0AAAAA9WZXJpZmljYXRpb25LZXkAAAAAAQAAA+kAAAACAAAH0AAAAAxHcm90aDE2RXJyb3I=",
        "AAAAAQAAAAAAAAAAAAAAD1ZlcmlmaWNhdGlvbktleQAAAAAFAAAAAAAAAAVhbHBoYQAAAAAAA+4AAABgAAAAAAAAAARiZXRhAAAD7gAAAMAAAAAAAAAABWRlbHRhAAAAAAAD7gAAAMAAAAAAAAAABWdhbW1hAAAAAAAD7gAAAMAAAAAAAAAAAmljAAAAAAPqAAAD7gAAAGA=",
        "AAAAAAAAAAAAAAAMdmVyaWZ5X3Byb29mAAAAAwAAAAAAAAACdmsAAAAAB9AAAAAPVmVyaWZpY2F0aW9uS2V5AAAAAAAAAAAFcHJvb2YAAAAAAAfQAAAABVByb29mAAAAAAAAAAAAAAtwdWJfc2lnbmFscwAAAAPqAAAADAAAAAEAAAPpAAAAAQAAB9AAAAAMR3JvdGgxNkVycm9y",
        "AAAAAAAAAAAAAAAPZ2V0X2F0dGVzdGF0aW9uAAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAQAAA+gAAAfQAAAAC0F0dGVzdGF0aW9uAA==",
        "AAAAAAAAAAAAAAARdmVyaWZ5X2FuZF9hdHRlc3QAAAAAAAACAAAAAAAAAAVwcm9vZgAAAAAAB9AAAAAFUHJvb2YAAAAAAAAAAAAAC3B1Yl9zaWduYWxzAAAAA+oAAAAMAAAAAQAAA+kAAAfQAAAAC0F0dGVzdGF0aW9uAAAAB9AAAAAMR3JvdGgxNkVycm9y" ]),
      options
    )
  }
  public readonly fromJSON = {
    latest: this.txFromJSON<Option<Attestation>>,
        set_vk: this.txFromJSON<Result<void>>,
        verify_proof: this.txFromJSON<Result<boolean>>,
        get_attestation: this.txFromJSON<Option<Attestation>>,
        verify_and_attest: this.txFromJSON<Result<Attestation>>
  }
}