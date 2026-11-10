import {
  Account,
  BASE_FEE,
  Keypair,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk"
import { JOB_STATUSES, type JobStatus, type Sha256Ref } from "@pactlane/core"
import { addressToScVal, amountToScVal, hashToScVal } from "./scval"
import { SimulationError } from "./tx"

export const PACTLANE_TESTNET = {
  network: "testnet",
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
  kernel: "CB3DJM7B7THZYCYINV22NATMRV3AFG4XX7235KYP2VVGOTRG2CGVKIQS",
  evaluationPolicy: "CCSAB45Q3NU6M7YLW4WVWC4MPQZZNLWYYBP2SAPSJ7NFBO4YTVDR43D7",
  token: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  admin: "GAAK4HAXR2R63O3O6MCNBFTQF7O5VGHKFLGTC7ZFGV3BV7UMCPHBUVHM",
  tokenDecimals: 7,
} as const

export const MAX_JOB_DURATION_SECONDS = 90 * 24 * 60 * 60

export const KERNEL_EVENT_NAMES = [
  "job_created",
  "provider_set",
  "budget_set",
  "job_funded",
  "job_submitted",
  "job_completed",
  "payment_released",
  "job_rejected",
  "job_expired",
  "refunded",
  "upgraded",
] as const

export const KERNEL_ERRORS: Record<number, string> = {
  1: "NotFound",
  2: "BadState",
  3: "BadActor",
  4: "BadExpiry",
  5: "Expired",
  6: "NotExpired",
  7: "BadBudget",
  8: "BudgetMismatch",
  9: "NoProvider",
  10: "ProviderAlreadySet",
  11: "RoleConflict",
  12: "IdOverflow",
}

export const POLICY_ERRORS: Record<number, string> = {
  101: "NotSigner",
  102: "AlreadySigner",
  103: "SignerConflict",
  104: "NoPendingOwner",
}

export interface ContractErrorInfo {
  code: number
  name: string
}

export function contractError(message: string): ContractErrorInfo | undefined {
  const m = /Error\(Contract, #(\d+)\)/.exec(message)
  if (!m) return undefined
  const code = Number(m[1])
  return { code, name: KERNEL_ERRORS[code] ?? POLICY_ERRORS[code] ?? "Unknown" }
}

export interface KernelJob {
  id: bigint
  client: string
  provider: string | null
  evaluator: string
  specHash: Sha256Ref
  budget: bigint
  expiresAt: number
  status: JobStatus
  workHash: Sha256Ref | null
  reason: Sha256Ref | null
}

type ReadRpc = Pick<rpc.Server, "simulateTransaction">

const READ_SOURCE = Keypair.random().publicKey()

export async function simulateRead(
  server: ReadRpc,
  networkPassphrase: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<xdr.ScVal> {
  const tx = new TransactionBuilder(new Account(READ_SOURCE, "0"), {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: method,
        args,
      })
    )
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) {
    throw new SimulationError(sim.error, sim.events)
  }
  if (!sim.result) throw new Error(`${method} returned no result`)
  return sim.result.retval
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

function hashRef(value: unknown): Sha256Ref | null {
  if (value === null || value === undefined) return null
  if (!(value instanceof Uint8Array) || value.length !== 32) {
    throw new Error("Expected a 32-byte hash")
  }
  return `sha256:${hex(value)}`
}

export function toKernelJob(value: xdr.ScVal): KernelJob {
  const raw = scValToNative(value) as Record<string, unknown>
  const status = JOB_STATUSES[Number(raw.state)]
  if (!status) throw new Error(`Unknown job state ${String(raw.state)}`)
  return {
    id: BigInt(raw.id as bigint),
    client: String(raw.client),
    provider: raw.provider == null ? null : String(raw.provider),
    evaluator: String(raw.evaluator),
    specHash: hashRef(raw.spec_hash)!,
    budget: BigInt(raw.budget as bigint),
    expiresAt: Number(raw.expires_at),
    status,
    workHash: hashRef(raw.work_hash),
    reason: hashRef(raw.reason),
  }
}

function u64(id: bigint): xdr.ScVal {
  if (id <= 0n) throw new RangeError("Job ids start at 1")
  return nativeToScVal(id, { type: "u64" })
}

const none = () => xdr.ScVal.scvVoid()

export interface KernelClientOptions {
  rpc: ReadRpc
  networkPassphrase?: string
  contractId?: string
}

export class KernelClient {
  readonly rpc: ReadRpc
  readonly networkPassphrase: string
  readonly contractId: string

  constructor(opts: KernelClientOptions) {
    this.rpc = opts.rpc
    this.networkPassphrase =
      opts.networkPassphrase ?? PACTLANE_TESTNET.networkPassphrase
    this.contractId = opts.contractId ?? PACTLANE_TESTNET.kernel
  }

  private read(method: string, args: xdr.ScVal[] = []) {
    return simulateRead(
      this.rpc,
      this.networkPassphrase,
      this.contractId,
      method,
      args
    )
  }

  async jobCount(): Promise<bigint> {
    return BigInt(scValToNative(await this.read("job_count")) as bigint)
  }

  async getJob(id: bigint): Promise<KernelJob | null> {
    try {
      return toKernelJob(await this.read("get_job", [u64(id)]))
    } catch (error) {
      if (
        error instanceof SimulationError &&
        contractError(error.message)?.name === "NotFound"
      ) {
        return null
      }
      throw error
    }
  }

  async listJobs({ limit = 50 }: { limit?: number } = {}): Promise<
    KernelJob[]
  > {
    const count = await this.jobCount()
    const ids: bigint[] = []
    for (let id = count; id >= 1n && ids.length < limit; id--) ids.push(id)
    const jobs = await Promise.all(ids.map((id) => this.getJob(id)))
    return jobs.filter((j): j is KernelJob => j !== null)
  }
}

export type KernelCall =
  | {
      method: "create_job"
      client: string
      provider?: string | null
      evaluator: string
      expiresAt: number
      specHash: string
    }
  | { method: "set_provider"; id: bigint; provider: string }
  | { method: "set_budget"; id: bigint; actor: string; amount: bigint }
  | { method: "fund"; id: bigint; expectedBudget: bigint }
  | { method: "submit"; id: bigint; workHash: string }
  | { method: "complete"; id: bigint; reason: string }
  | { method: "reject"; id: bigint; reason?: string | null }
  | { method: "claim_refund"; id: bigint }

export function kernelArgs(call: KernelCall): xdr.ScVal[] {
  switch (call.method) {
    case "create_job": {
      if (!Number.isSafeInteger(call.expiresAt) || call.expiresAt <= 0) {
        throw new RangeError("expiresAt must be a unix timestamp in seconds")
      }
      return [
        addressToScVal(call.client),
        call.provider ? addressToScVal(call.provider) : none(),
        addressToScVal(call.evaluator),
        nativeToScVal(BigInt(call.expiresAt), { type: "u64" }),
        hashToScVal(call.specHash),
      ]
    }
    case "set_provider":
      return [u64(call.id), addressToScVal(call.provider)]
    case "set_budget":
      return [u64(call.id), addressToScVal(call.actor), positive(call.amount)]
    case "fund":
      return [u64(call.id), positive(call.expectedBudget)]
    case "submit":
      return [u64(call.id), hashToScVal(call.workHash)]
    case "complete":
      return [u64(call.id), hashToScVal(call.reason)]
    case "reject":
      return [u64(call.id), call.reason ? hashToScVal(call.reason) : none()]
    case "claim_refund":
      return [u64(call.id)]
  }
}

function positive(amount: bigint): xdr.ScVal {
  if (amount <= 0n) throw new RangeError("Budget must be greater than zero")
  return amountToScVal(amount)
}

export function jobActionsFor(
  job: KernelJob,
  address: string,
  nowSeconds: number
): KernelCall["method"][] {
  const live = nowSeconds < job.expiresAt
  const isClient = address === job.client
  const isProvider = address === job.provider
  const isEvaluator = address === job.evaluator
  const actions: KernelCall["method"][] = []
  switch (job.status) {
    case "open":
      if (isClient && !job.provider && live) actions.push("set_provider")
      if ((isClient || isProvider) && live) actions.push("set_budget")
      if (isClient && job.provider && job.budget > 0n && live) {
        actions.push("fund")
      }
      if (isClient) actions.push("reject")
      break
    case "funded":
      if (isProvider && live) actions.push("submit")
      if (isEvaluator && live) actions.push("reject")
      if (!live) actions.push("claim_refund")
      break
    case "submitted":
      if (isEvaluator && live) actions.push("complete", "reject")
      if (!live) actions.push("claim_refund")
      break
  }
  return actions
}
