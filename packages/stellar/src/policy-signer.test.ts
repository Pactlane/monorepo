import { describe, expect, test } from "bun:test"
import {
  Account,
  Address,
  Keypair,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk"
import { STELLAR_NETWORKS } from "@pactlane/config"
import { KeypairSigner } from "./signer.test-only"
import { PACTLANE_TESTNET } from "./kernel"
import {
  SpendingPolicyError,
  memorySpendStore,
  withSpendingPolicy,
} from "./policy-signer"

const TESTNET = STELLAR_NETWORKS.testnet.passphrase
const opts = { networkPassphrase: TESTNET }
const { kernel: KERNEL, token: USDC } = PACTLANE_TESTNET
const OTHER = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
const inner = KeypairSigner.random()
const me = await inner.address()

function invoke(contract: string, method: string, args: xdr.ScVal[]) {
  return new TransactionBuilder(new Account(me, "1"), {
    fee: "100",
    networkPassphrase: TESTNET,
  })
    .addOperation(
      Operation.invokeContractFunction({ contract, function: method, args })
    )
    .setTimeout(30)
    .build()
    .toXDR()
}
const u64 = (n: bigint) => nativeToScVal(n, { type: "u64" })
const i128 = (n: bigint) => nativeToScVal(n, { type: "i128" })
const addr = (a: string) => new Address(a).toScVal()
const fund = (amount: bigint) => invoke(KERNEL, "fund", [u64(1n), i128(amount)])
const transfer = (amount: bigint) =>
  invoke(USDC, "transfer", [
    addr(me),
    addr(Keypair.random().publicKey()),
    i128(amount),
  ])

function policy(day = "2026-11-10T12:00:00Z") {
  let clock = new Date(day)
  const store = memorySpendStore()
  const signer = withSpendingPolicy(inner, {
    maxPerTx: 10_000_000n,
    maxPerDay: 25_000_000n,
    allowedContracts: [KERNEL, USDC],
    store,
    now: () => clock,
  })
  return { signer, store, setDay: (d: string) => (clock = new Date(d)) }
}

describe("withSpendingPolicy", () => {
  test("signs allowlisted calls within the caps and records spend", async () => {
    const { signer, store } = policy()
    const signed = await signer.signTransaction(fund(10_000_000n), opts)
    expect(TransactionBuilder.fromXDR(signed, TESTNET).signatures).toHaveLength(
      1
    )
    await signer.signTransaction(transfer(5_000_000n), opts)
    await signer.signTransaction(
      invoke(KERNEL, "submit", [
        u64(1n),
        xdr.ScVal.scvBytes(new Uint8Array(32)),
      ]),
      opts
    )
    expect(await store.spent("2026-11-10")).toBe(15_000_000n)
  })

  test("refuses over the per-transaction cap", async () => {
    await expect(
      policy().signer.signTransaction(fund(10_000_001n), opts)
    ).rejects.toThrow("over the per-transaction cap of 10000000")
  })

  test("refuses over the daily cap and resets the next UTC day", async () => {
    const { signer, setDay } = policy()
    await signer.signTransaction(fund(10_000_000n), opts)
    await signer.signTransaction(fund(10_000_000n), opts)
    await expect(
      signer.signTransaction(fund(6_000_000n), opts)
    ).rejects.toThrow("exceeds the daily cap of 25000000")
    setDay("2026-11-11T00:00:00Z")
    await expect(
      signer.signTransaction(fund(6_000_000n), opts)
    ).resolves.toBeString()
  })

  test("concurrent requests cannot both slip under the daily cap", async () => {
    const { signer } = policy()
    const results = await Promise.allSettled([
      signer.signTransaction(fund(10_000_000n), opts),
      signer.signTransaction(fund(10_000_000n), opts),
      signer.signTransaction(fund(10_000_000n), opts),
    ])
    expect(results.map((r) => r.status)).toEqual([
      "fulfilled",
      "fulfilled",
      "rejected",
    ])
  })

  test.each([
    [
      "a contract off the allowlist",
      () => invoke(OTHER, "transfer", [addr(me), addr(me), i128(1n)]),
      "not on the allowlist",
    ],
    [
      "an unknown method",
      () => invoke(KERNEL, "upgrade", [xdr.ScVal.scvBytes(new Uint8Array(32))]),
      "Unknown method upgrade",
    ],
    [
      "an unreadable amount",
      () => invoke(KERNEL, "fund", [u64(1n)]),
      "Cannot read the amount",
    ],
    [
      "a classic payment",
      () =>
        new TransactionBuilder(new Account(me, "1"), {
          fee: "100",
          networkPassphrase: TESTNET,
        })
          .addOperation(Operation.bumpSequence({ bumpTo: "9" }))
          .setTimeout(30)
          .build()
          .toXDR(),
      "is not a contract call",
    ],
  ])("refuses %s with a clear error", async (_label, build, message) => {
    const error = await policy()
      .signer.signTransaction(build(), opts)
      .then(
        () => undefined,
        (e: unknown) => e
      )
    expect(error).toBeInstanceOf(SpendingPolicyError)
    expect((error as Error).message).toContain(message)
  })

  test("does not expose auth-entry signing", () => {
    expect(policy().signer.signAuthEntry).toBeUndefined()
  })
})
