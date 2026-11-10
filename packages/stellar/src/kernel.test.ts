import { describe, expect, test } from "bun:test"
import {
  Address,
  Keypair,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
  type Transaction,
} from "@stellar/stellar-sdk"
import {
  contractError,
  jobActionsFor,
  KernelClient,
  kernelArgs,
  PACTLANE_TESTNET,
  toKernelJob,
  type KernelJob,
} from "./kernel"

const sym = (s: string) => xdr.ScVal.scvSymbol(s)
const entry = (k: string, v: xdr.ScVal) =>
  new xdr.ScMapEntry({ key: sym(k), val: v })
const addr = (a: string) => Address.fromString(a).toScVal()
const bytes = (b: number) => xdr.ScVal.scvBytes(new Uint8Array(32).fill(b))

const CLIENT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHK3M"
const EVALUATOR = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAK3IM"
const PROVIDER = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAITA4"

function jobScVal(over: Partial<Record<string, xdr.ScVal>> = {}): xdr.ScVal {
  const fields: Record<string, xdr.ScVal> = {
    budget: nativeToScVal(0n, { type: "i128" }),
    client: addr(CLIENT),
    evaluator: addr(EVALUATOR),
    expires_at: nativeToScVal(1800604800n, { type: "u64" }),
    id: nativeToScVal(1n, { type: "u64" }),
    provider: addr(PROVIDER),
    reason: xdr.ScVal.scvVoid(),
    spec_hash: bytes(1),
    state: xdr.ScVal.scvU32(0),
    work_hash: xdr.ScVal.scvVoid(),
    ...over,
  }
  return xdr.ScVal.scvMap(
    Object.keys(fields)
      .sort()
      .map((k) => entry(k, fields[k]!))
  )
}

function fakeRpc(
  handler: (method: string, args: xdr.ScVal[]) => xdr.ScVal | string
) {
  const calls: { contract: string; method: string }[] = []
  return {
    calls,
    rpc: {
      async simulateTransaction(tx: Transaction) {
        const op = tx.operations[0]
        if (op?.type !== "invokeHostFunction") throw new Error("bad op")
        const fn = op.func as unknown as {
          invokeContract: xdr.InvokeContractArgs
        }
        const call = fn.invokeContract
        const method = String(call.functionName)
        calls.push({
          contract: Address.fromScAddress(call.contractAddress).toString(),
          method,
        })
        const out = handler(method, call.args)
        if (typeof out === "string") {
          return {
            id: "1",
            latestLedger: 1,
            _parsed: true,
            events: [],
            error: out,
          }
        }
        return {
          id: "1",
          latestLedger: 1,
          _parsed: true,
          events: [],
          minResourceFee: "0",
          transactionData: undefined as never,
          result: { auth: [], retval: out },
        } as rpc.Api.SimulateTransactionSuccessResponse
      },
    },
  }
}

describe("toKernelJob", () => {
  test("decodes the Job layout from the kernel test snapshot", () => {
    expect(toKernelJob(jobScVal())).toEqual({
      id: 1n,
      client: CLIENT,
      provider: PROVIDER,
      evaluator: EVALUATOR,
      specHash: `sha256:${"01".repeat(32)}`,
      budget: 0n,
      expiresAt: 1800604800,
      status: "open",
      workHash: null,
      reason: null,
    })
  })

  test("decodes optional fields and every state", () => {
    const job = toKernelJob(
      jobScVal({
        provider: xdr.ScVal.scvVoid(),
        work_hash: bytes(2),
        reason: bytes(3),
        state: xdr.ScVal.scvU32(4),
      })
    )
    expect(job.provider).toBeNull()
    expect(job.workHash).toBe(`sha256:${"02".repeat(32)}`)
    expect(job.reason).toBe(`sha256:${"03".repeat(32)}`)
    expect(job.status).toBe("rejected")
    const states = [0, 1, 2, 3, 4, 5].map(
      (s) => toKernelJob(jobScVal({ state: xdr.ScVal.scvU32(s) })).status
    )
    expect(states).toEqual([
      "open",
      "funded",
      "submitted",
      "completed",
      "rejected",
      "expired",
    ])
    expect(() =>
      toKernelJob(jobScVal({ state: xdr.ScVal.scvU32(6) }))
    ).toThrow()
  })
})

describe("KernelClient", () => {
  function pagedKernel(count: number) {
    const pages: [bigint, number][] = []
    const fake = fakeRpc((method, args) => {
      if (method === "job_count") {
        return nativeToScVal(BigInt(count), { type: "u64" })
      }
      if (method === "get_jobs") {
        const start = scValToNative(args[0]!) as bigint
        const limit = Math.min(Number(scValToNative(args[1]!)), 50)
        pages.push([start, limit])
        const jobs: xdr.ScVal[] = []
        for (
          let id = start < 1n ? 1n : start;
          id <= BigInt(count) && jobs.length < limit;
          id++
        ) {
          jobs.push(jobScVal({ id: nativeToScVal(id, { type: "u64" }) }))
        }
        return xdr.ScVal.scvVec(jobs)
      }
      const id = scValToNative(args[0]!) as bigint
      if (id > BigInt(count)) return "HostError: Error(Contract, #1)"
      return jobScVal({ id: nativeToScVal(id, { type: "u64" }) })
    })
    return { fake, pages, kernel: new KernelClient({ rpc: fake.rpc }) }
  }

  test("lists newest first through get_jobs at the testnet kernel", async () => {
    const { fake, pages, kernel } = pagedKernel(3)
    const jobs = await kernel.listJobs()
    expect(jobs.map((j) => j.id)).toEqual([3n, 2n, 1n])
    expect(pages).toEqual([[1n, 3]])
    expect(new Set(fake.calls.map((c) => c.contract))).toEqual(
      new Set([PACTLANE_TESTNET.kernel])
    )
    expect(await kernel.getJob(4n)).toBeNull()
  })

  test("pages backwards in chunks of at most 50", async () => {
    const { pages, kernel } = pagedKernel(120)
    const jobs = await kernel.listJobs({ limit: 75 })
    expect(jobs.map((j) => Number(j.id))).toEqual(
      Array.from({ length: 75 }, (_, i) => 120 - i)
    )
    expect(pages).toEqual([
      [71n, 50],
      [46n, 25],
    ])
  })

  test("an empty kernel lists nothing without calling get_jobs", async () => {
    const { pages, kernel } = pagedKernel(0)
    expect(await kernel.listJobs()).toEqual([])
    expect(pages).toHaveLength(0)
  })

  test("rethrows errors other than NotFound", async () => {
    const fake = fakeRpc(() => "HostError: Error(Contract, #2)")
    const kernel = new KernelClient({ rpc: fake.rpc })
    await expect(kernel.getJob(1n)).rejects.toThrow("Error(Contract, #2)")
  })
})

describe("contractError", () => {
  test.each([
    ["HostError: Error(Contract, #8)", { code: 8, name: "BudgetMismatch" }],
    ["Error(Contract, #101)", { code: 101, name: "NotSigner" }],
    ["Error(Contract, #77)", { code: 77, name: "Unknown" }],
  ])("maps %p", (msg, expected) => {
    expect(contractError(msg)).toEqual(expected)
  })
  test("ignores non-contract errors", () => {
    expect(contractError("Error(Auth, InvalidAction)")).toBeUndefined()
  })
})

describe("kernelArgs", () => {
  const client = Keypair.random().publicKey()
  const evaluator = Keypair.random().publicKey()
  const spec = `sha256:${"ab".repeat(32)}`

  test("encodes create_job with an empty provider as void", () => {
    const args = kernelArgs({
      method: "create_job",
      client,
      evaluator,
      expiresAt: 1800604800,
      specHash: spec,
    })
    expect(args.map((a) => a.type)).toEqual([
      "scvAddress",
      "scvVoid",
      "scvAddress",
      "scvU64",
      "scvBytes",
    ])
    expect(scValToNative(args[3]!)).toBe(1800604800n)
  })

  test("encodes fund and reject", () => {
    const fund = kernelArgs({
      method: "fund",
      id: 7n,
      expectedBudget: 4_000_000n,
    })
    expect(fund.map((a) => scValToNative(a))).toEqual([7n, 4_000_000n])
    expect(fund[1]!.type).toBe("scvI128")
    expect(kernelArgs({ method: "reject", id: 7n })[1]!.type).toBe("scvVoid")
  })

  test("rejects invalid ids, budgets and expiry", () => {
    expect(() => kernelArgs({ method: "claim_refund", id: 0n })).toThrow(
      RangeError
    )
    expect(() =>
      kernelArgs({ method: "fund", id: 1n, expectedBudget: 0n })
    ).toThrow(RangeError)
    expect(() =>
      kernelArgs({
        method: "create_job",
        client,
        evaluator,
        expiresAt: 1.5,
        specHash: spec,
      })
    ).toThrow(RangeError)
  })
})

describe("jobActionsFor", () => {
  const base: KernelJob = toKernelJob(jobScVal())
  const now = 1800604800 - 100
  const after = 1800604800 + 1

  test("open job", () => {
    expect(jobActionsFor({ ...base, provider: null }, CLIENT, now)).toEqual([
      "set_provider",
      "set_budget",
      "reject",
    ])
    expect(jobActionsFor({ ...base, budget: 5n }, CLIENT, now)).toEqual([
      "set_budget",
      "fund",
      "reject",
    ])
    expect(jobActionsFor(base, PROVIDER, now)).toEqual(["set_budget"])
    expect(jobActionsFor(base, EVALUATOR, now)).toEqual([])
    expect(jobActionsFor({ ...base, budget: 5n }, CLIENT, after)).toEqual([
      "reject",
    ])
  })

  test("funded and submitted jobs", () => {
    const funded = { ...base, status: "funded" as const, budget: 5n }
    expect(jobActionsFor(funded, PROVIDER, now)).toEqual(["submit"])
    expect(jobActionsFor(funded, EVALUATOR, now)).toEqual(["reject"])
    expect(jobActionsFor(funded, CLIENT, after)).toEqual(["claim_refund"])
    const submitted = { ...funded, status: "submitted" as const }
    expect(jobActionsFor(submitted, EVALUATOR, now)).toEqual([
      "complete",
      "reject",
    ])
    expect(jobActionsFor(submitted, CLIENT, now)).toEqual([])
  })

  test("terminal jobs have no actions", () => {
    for (const status of ["completed", "rejected", "expired"] as const) {
      expect(jobActionsFor({ ...base, status }, CLIENT, after)).toEqual([])
    }
  })
})
