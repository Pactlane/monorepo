import {
  Address,
  TransactionBuilder,
  scValToNative,
  type xdr,
} from "@stellar/stellar-sdk"
import type { Signer, SignOptions } from "./signer"

export type AmountArg = number | null

export const DEFAULT_SPEND_METHODS: Record<string, AmountArg> = {
  transfer: 2,
  fund: 1,
  create_job: null,
  set_provider: null,
  set_budget: null,
  submit: null,
  complete: null,
  reject: null,
  claim_refund: null,
  extend_ttl: null,
}

export interface SpendStore {
  spent(day: string): Promise<bigint>
  record(day: string, amount: bigint): Promise<void>
}

export function memorySpendStore(): SpendStore {
  const days = new Map<string, bigint>()
  return {
    async spent(day) {
      return days.get(day) ?? 0n
    },
    async record(day, amount) {
      days.set(day, (days.get(day) ?? 0n) + amount)
    },
  }
}

export interface SpendingPolicy {
  maxPerTx: bigint
  maxPerDay: bigint
  allowedContracts: string[]
  methods?: Record<string, AmountArg>
  store?: SpendStore
  now?: () => Date
}

export class SpendingPolicyError extends Error {
  override readonly name = "SpendingPolicyError"
}

export interface DecodedSpend {
  contract: string
  method: string
  amount: bigint
}

export function decodeSpend(
  xdrText: string,
  networkPassphrase: string,
  methods: Record<string, AmountArg> = DEFAULT_SPEND_METHODS
): DecodedSpend {
  const tx = TransactionBuilder.fromXDR(xdrText, networkPassphrase)
  if ("innerTransaction" in tx) {
    throw new SpendingPolicyError("Fee-bump transactions are not allowed")
  }
  if (tx.operations.length !== 1) {
    throw new SpendingPolicyError(
      "Only single-operation transactions are allowed"
    )
  }
  const op = tx.operations[0]!
  if (op.type !== "invokeHostFunction") {
    throw new SpendingPolicyError(`Operation ${op.type} is not a contract call`)
  }
  const call = (
    op.func as unknown as { invokeContract?: xdr.InvokeContractArgs }
  ).invokeContract
  if (!call)
    throw new SpendingPolicyError("Only contract invocations are allowed")
  const contract = Address.fromScAddress(call.contractAddress).toString()
  const method = String(call.functionName)
  if (!Object.hasOwn(methods, method)) {
    throw new SpendingPolicyError(
      `Unknown method ${method}; cannot tell what it spends`
    )
  }
  const index = methods[method]!
  if (index === null) return { contract, method, amount: 0n }
  const arg = call.args[index]
  const amount = arg === undefined ? undefined : scValToNative(arg)
  if (typeof amount !== "bigint" || amount < 0n) {
    throw new SpendingPolicyError(
      `Cannot read the amount argument of ${method}`
    )
  }
  return { contract, method, amount }
}

const utcDay = (date: Date) => date.toISOString().slice(0, 10)

export function withSpendingPolicy(
  signer: Signer,
  policy: SpendingPolicy
): Signer {
  if (policy.maxPerTx < 0n || policy.maxPerDay < 0n) {
    throw new RangeError("Spending caps must not be negative")
  }
  const allowed = new Set(policy.allowedContracts)
  const store = policy.store ?? memorySpendStore()
  const now = policy.now ?? (() => new Date())
  let queue: Promise<unknown> = Promise.resolve()

  async function sign(xdrText: string, opts: SignOptions): Promise<string> {
    const spend = decodeSpend(xdrText, opts.networkPassphrase, policy.methods)
    if (!allowed.has(spend.contract)) {
      throw new SpendingPolicyError(
        `Contract ${spend.contract} is not on the allowlist`
      )
    }
    if (spend.amount > policy.maxPerTx) {
      throw new SpendingPolicyError(
        `${spend.method} spends ${spend.amount}, over the per-transaction cap of ${policy.maxPerTx}`
      )
    }
    const day = utcDay(now())
    const spent = await store.spent(day)
    if (spent + spend.amount > policy.maxPerDay) {
      throw new SpendingPolicyError(
        `${spend.method} spends ${spend.amount}; with ${spent} already spent today that exceeds the daily cap of ${policy.maxPerDay}`
      )
    }
    const signed = await signer.signTransaction(xdrText, opts)
    if (spend.amount > 0n) await store.record(day, spend.amount)
    return signed
  }

  return {
    address: () => signer.address(),
    signTransaction(xdrText, opts) {
      const run = queue.then(() => sign(xdrText, opts))
      queue = run.catch(() => {})
      return run
    },
  }
}
