import { afterEach, describe, expect, test } from "bun:test"
import {
  Account,
  Keypair,
  Operation,
  TransactionBuilder,
  hash,
} from "@stellar/stellar-sdk"
import { STELLAR_NETWORKS } from "@pactlane/config"
import * as root from "./index"
import type { Signer } from "./index"
import { KeypairSigner } from "./signer.test-only"
import pkg from "../package.json"

const TESTNET = STELLAR_NETWORKS.testnet.passphrase
const originalEnv = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = originalEnv
})

function unsignedTx(source: string) {
  return new TransactionBuilder(new Account(source, "1"), {
    fee: "100",
    networkPassphrase: TESTNET,
  })
    .addOperation(Operation.bumpSequence({ bumpTo: "5" }))
    .setTimeout(30)
    .build()
    .toXDR()
}

describe("KeypairSigner", () => {
  test("implements Signer and signs transactions verifiably", async () => {
    const kp = Keypair.random()
    const signer: Signer = new KeypairSigner(kp)
    expect(await signer.address()).toBe(kp.publicKey())
    const signed = await signer.signTransaction(unsignedTx(kp.publicKey()), {
      networkPassphrase: TESTNET,
    })
    const tx = TransactionBuilder.fromXDR(signed, TESTNET)
    expect(tx.signatures).toHaveLength(1)
    expect(kp.verify(tx.hash(), tx.signatures[0]!.signature)).toBe(true)
  })

  test("signs the SHA-256 of an auth entry preimage", async () => {
    const kp = Keypair.random()
    const signer = new KeypairSigner(kp)
    const preimage = btoa("auth-entry-preimage")
    const signature = await signer.signAuthEntry(preimage, {
      networkPassphrase: TESTNET,
    })
    const bytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0))
    const digest = hash(Uint8Array.from(atob(preimage), (c) => c.charCodeAt(0)))
    expect(kp.verify(digest, bytes)).toBe(true)
  })

  test("refuses another address and public-only keypairs", async () => {
    const signer = KeypairSigner.random()
    await expect(
      signer.signTransaction(unsignedTx(await signer.address()), {
        networkPassphrase: TESTNET,
        address: Keypair.random().publicKey(),
      })
    ).rejects.toThrow("not G")
    expect(
      () =>
        new KeypairSigner(Keypair.fromPublicKey(Keypair.random().publicKey()))
    ).toThrow("needs a keypair with a secret")
  })

  test("throws in production", () => {
    process.env.NODE_ENV = "production"
    expect(() => KeypairSigner.random()).toThrow("tests only")
  })
})

describe("package exports", () => {
  test("KeypairSigner is only exposed from @pactlane/stellar/testing", () => {
    expect("KeypairSigner" in root).toBe(false)
    expect(pkg.exports["./testing"]).toBe("./src/signer.test-only.ts")
  })
})
