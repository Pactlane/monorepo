import { describe, expect, test } from "bun:test"
import {
  Account,
  Keypair,
  Operation,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk"
import { STELLAR_NETWORKS } from "@pactlane/config"
import { pollTransaction, submitAndWait, type SubmitRpc } from "./submit"

const TESTNET = STELLAR_NETWORKS.testnet.passphrase
const { SUCCESS, FAILED, NOT_FOUND } = rpc.Api.GetTransactionStatus

function signedTx() {
  const kp = Keypair.random()
  const tx = new TransactionBuilder(new Account(kp.publicKey(), "1"), {
    fee: "100",
    networkPassphrase: TESTNET,
  })
    .addOperation(Operation.bumpSequence({ bumpTo: "10" }))
    .setTimeout(30)
    .build()
  tx.sign(kp)
  const hash = Array.from(tx.hash(), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("")
  return { xdr: tx.toXDR(), hash }
}

type Send = rpc.Api.SendTransactionStatus | Error
type Get = rpc.Api.GetTransactionStatus | Error

function fakeRpc(send: Send, gets: Get[], extra: object = {}) {
  const sent: string[] = []
  const polled: string[] = []
  const fake: SubmitRpc = {
    async sendTransaction(tx) {
      sent.push(tx.toXDR())
      if (send instanceof Error) throw send
      return {
        status: send,
        hash: "server-hash",
        latestLedger: 1,
        latestLedgerCloseTime: 1,
        ...extra,
      }
    },
    async getTransaction(hash) {
      polled.push(hash)
      const next = gets.length > 1 ? gets.shift()! : gets[0]!
      if (next instanceof Error) throw next
      return {
        status: next,
        txHash: hash,
        ledger: 77,
        returnValue: xdr.ScVal.scvU32(1),
        latestLedger: 80,
        latestLedgerCloseTime: 1,
        oldestLedger: 1,
        oldestLedgerCloseTime: 1,
      } as unknown as rpc.Api.GetTransactionResponse
    },
  }
  return { fake, sent, polled }
}

function fakeClock() {
  let t = 0
  const sleeps: number[] = []
  return {
    sleeps,
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms)
      t += ms
    },
  }
}

describe("submitAndWait", () => {
  test("polls a pending transaction until success", async () => {
    const tx = signedTx()
    const { fake, sent, polled } = fakeRpc("PENDING", [NOT_FOUND, SUCCESS])
    const clock = fakeClock()
    const result = await submitAndWait(fake, tx.xdr, {
      networkPassphrase: TESTNET,
      ...clock,
    })
    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("unreachable")
    expect(result.hash).toBe(tx.hash)
    expect(result.ledger).toBe(77)
    expect(result.returnValue?.toXDR("base64")).toBe(
      xdr.ScVal.scvU32(1).toXDR("base64")
    )
    expect(sent).toEqual([tx.xdr])
    expect(polled).toEqual([tx.hash, tx.hash])
    expect(clock.sleeps).toEqual([1_000, 2_000])
  })

  test("reports an on-chain failure", async () => {
    const tx = signedTx()
    const { fake, sent } = fakeRpc("PENDING", [FAILED])
    const result = await submitAndWait(fake, tx.xdr, {
      networkPassphrase: TESTNET,
      ...fakeClock(),
    })
    expect(result).toMatchObject({
      status: "failed",
      hash: tx.hash,
      ledger: 77,
    })
    expect(sent).toHaveLength(1)
  })

  test("follows a duplicate submission without resubmitting", async () => {
    const tx = signedTx()
    const { fake, sent, polled } = fakeRpc("DUPLICATE", [NOT_FOUND, SUCCESS])
    const result = await submitAndWait(fake, tx.xdr, {
      networkPassphrase: TESTNET,
      ...fakeClock(),
    })
    expect(result.status).toBe("success")
    expect(sent).toHaveLength(1)
    expect(polled).toHaveLength(2)
  })

  test("returns unknown on timeout with capped exponential backoff", async () => {
    const tx = signedTx()
    const { fake, sent, polled } = fakeRpc("PENDING", [NOT_FOUND])
    const clock = fakeClock()
    const result = await submitAndWait(fake, tx.xdr, {
      networkPassphrase: TESTNET,
      timeoutMs: 10_000,
      initialDelayMs: 1_000,
      maxDelayMs: 4_000,
      ...clock,
    })
    expect(result).toEqual({ status: "unknown", hash: tx.hash })
    expect(clock.sleeps).toEqual([1_000, 2_000, 4_000, 3_000])
    expect(polled).toHaveLength(4)
    expect(sent).toHaveLength(1)
  })

  test("returns rejected for an ERROR response without polling", async () => {
    const tx = signedTx()
    const errorResult = {
      marker: "txBadSeq",
    } as unknown as xdr.TransactionResult
    const diagnosticEvents = [{}] as unknown as xdr.DiagnosticEvent[]
    const { fake, polled } = fakeRpc("ERROR", [SUCCESS], {
      errorResult,
      diagnosticEvents,
    })
    const result = await submitAndWait(fake, tx.xdr, {
      networkPassphrase: TESTNET,
      ...fakeClock(),
    })
    expect(result).toEqual({
      status: "rejected",
      hash: tx.hash,
      errorResult,
      diagnosticEvents,
    })
    expect(polled).toHaveLength(0)
  })

  test("returns try_again_later after one status check, never resubmitting", async () => {
    const tx = signedTx()
    const { fake, sent, polled } = fakeRpc("TRY_AGAIN_LATER", [NOT_FOUND])
    const clock = fakeClock()
    const result = await submitAndWait(fake, tx.xdr, {
      networkPassphrase: TESTNET,
      ...clock,
    })
    expect(result).toEqual({ status: "try_again_later", hash: tx.hash })
    expect(sent).toHaveLength(1)
    expect(polled).toEqual([tx.hash])
    expect(clock.sleeps).toHaveLength(0)
  })

  test("try_again_later for an already applied transaction reports it", async () => {
    const tx = signedTx()
    const { fake, sent } = fakeRpc("TRY_AGAIN_LATER", [SUCCESS])
    const result = await submitAndWait(fake, tx.xdr, {
      networkPassphrase: TESTNET,
      ...fakeClock(),
    })
    expect(result).toMatchObject({ status: "success", hash: tx.hash })
    expect(sent).toHaveLength(1)
  })

  test("reconciles by local hash when sendTransaction throws", async () => {
    const tx = signedTx()
    const { fake, sent, polled } = fakeRpc(new Error("socket hang up"), [
      SUCCESS,
    ])
    const result = await submitAndWait(fake, tx.xdr, {
      networkPassphrase: TESTNET,
      ...fakeClock(),
    })
    expect(result.status).toBe("success")
    expect(sent).toHaveLength(1)
    expect(polled).toEqual([tx.hash])
  })

  test("keeps polling through transient getTransaction errors", async () => {
    const tx = signedTx()
    const { fake } = fakeRpc("PENDING", [new Error("502"), SUCCESS])
    const result = await submitAndWait(fake, tx.xdr, {
      networkPassphrase: TESTNET,
      ...fakeClock(),
    })
    expect(result.status).toBe("success")
  })
})

describe("pollTransaction", () => {
  test("rejects non-positive delays", async () => {
    const { fake } = fakeRpc("PENDING", [SUCCESS])
    await expect(
      pollTransaction(fake, "abc", { initialDelayMs: 0 })
    ).rejects.toThrow(RangeError)
  })
})
