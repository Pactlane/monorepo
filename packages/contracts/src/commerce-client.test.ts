import { describe, expect, test } from "bun:test"
import { Keypair, scValToNative, type xdr } from "@stellar/stellar-sdk"
import { PACTLANE_TESTNET } from "@pactlane/stellar"
import { CommerceKernelClient, type Invoke } from "./commerce-client"

const client = Keypair.random().publicKey()
const provider = Keypair.random().publicKey()
const evaluator = Keypair.random().publicKey()
const spec = `sha256:${"ab".repeat(32)}`
const work = `sha256:${"cd".repeat(32)}`

function recorder() {
  const calls: { contractId: string; method: string; args: xdr.ScVal[] }[] = []
  const invoke: Invoke = async (contractId, method, args) => {
    calls.push({ contractId, method, args })
    return { xdr: `unsigned-${method}` }
  }
  return { calls, kernel: new CommerceKernelClient(invoke) }
}

const native = (args: xdr.ScVal[]) =>
  args.map((a) => {
    const v = scValToNative(a)
    return v instanceof Uint8Array ? `0x${Buffer.from(v).toString("hex")}` : v
  })

describe("CommerceKernelClient", () => {
  test("targets the testnet kernel and returns the unsigned xdr from invoke", async () => {
    const { calls, kernel } = recorder()
    expect(await kernel.claimRefund({ id: 7n })).toEqual({
      xdr: "unsigned-claim_refund",
    })
    expect(calls[0]!.contractId).toBe(PACTLANE_TESTNET.kernel)
  })

  test("encodes each method's name and arguments", async () => {
    const { calls, kernel } = recorder()
    await kernel.createJob({
      client,
      provider: null,
      evaluator,
      expiresAt: 1_900_000_000,
      specHash: spec,
    })
    await kernel.setProvider({ id: 1n, provider })
    await kernel.setBudget({ id: 1n, actor: client, amount: 20_000_000n })
    await kernel.fund({ id: 1n, expectedBudget: 20_000_000n })
    await kernel.submit({ id: 1n, workHash: work })
    await kernel.complete({ id: 1n, reason: work })
    await kernel.reject({ id: 1n })
    await kernel.claimRefund({ id: 1n })

    expect(calls.map((c) => c.method)).toEqual([
      "create_job",
      "set_provider",
      "set_budget",
      "fund",
      "submit",
      "complete",
      "reject",
      "claim_refund",
    ])
    expect(native(calls[0]!.args)).toEqual([
      client,
      null,
      evaluator,
      1_900_000_000n,
      `0x${"ab".repeat(32)}`,
    ])
    expect(calls[0]!.args.map((a) => a.type)).toEqual([
      "scvAddress",
      "scvVoid",
      "scvAddress",
      "scvU64",
      "scvBytes",
    ])
    expect(native(calls[2]!.args)).toEqual([1n, client, 20_000_000n])
    expect(calls[2]!.args[2]!.type).toBe("scvI128")
    expect(native(calls[3]!.args)).toEqual([1n, 20_000_000n])
    expect(native(calls[4]!.args)).toEqual([1n, `0x${"cd".repeat(32)}`])
    expect(calls[6]!.args[1]!.type).toBe("scvVoid")
  })

  test("refuses bad input before invoking", async () => {
    const { calls, kernel } = recorder()
    expect(() => kernel.fund({ id: 1n, expectedBudget: 0n })).toThrow(
      RangeError
    )
    expect(() => kernel.submit({ id: 1n, workHash: "sha256:nope" })).toThrow(
      "Invalid sha256"
    )
    expect(calls).toHaveLength(0)
  })

  test("contains no signing: invoke receives only contract, method and args", async () => {
    const { calls, kernel } = recorder()
    await kernel.fund({ id: 1n, expectedBudget: 1n })
    expect(Object.keys(calls[0]!).sort()).toEqual([
      "args",
      "contractId",
      "method",
    ])
  })
})
