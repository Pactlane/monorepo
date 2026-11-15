import {
  KernelClient,
  PACTLANE_TESTNET,
  SimulationError,
  addressToScVal,
  sacContractId,
  simulateRead,
  contractError,
  createRpc,
  kernelArgs,
  prepareInvoke,
  submitAndWait,
  type KernelCall,
  type KernelJob,
} from "@pactlane/stellar"
import { scValToNative, xdr, type rpc } from "@stellar/stellar-sdk"
import type { JobStatus } from "@pactlane/core/job"

export const DEPLOYMENT = PACTLANE_TESTNET

let rpcPromise: Promise<rpc.Server> | undefined

async function connect(attempts = 2): Promise<rpc.Server> {
  const config = {
    rpcUrl: process.env.STELLAR_RPC_URL || DEPLOYMENT.rpcUrl,
    networkPassphrase: DEPLOYMENT.networkPassphrase,
  }
  for (let attempt = 1; ; attempt++) {
    try {
      return await createRpc(config, { timeoutMs: 15_000 })
    } catch (error) {
      const unreachable =
        error instanceof Error && error.message.startsWith("Cannot reach")
      if (!unreachable || attempt >= attempts) throw error
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
}

function server(): Promise<rpc.Server> {
  rpcPromise ??= connect()
  rpcPromise.catch(() => (rpcPromise = undefined))
  return rpcPromise
}

async function kernel() {
  return new KernelClient({ rpc: await server() })
}

export interface JobView {
  id: string
  client: string
  provider: string | null
  evaluator: string
  specHash: string
  budget: string
  expiresAt: number
  status: JobStatus
  workHash: string | null
  reason: string | null
}

function toView(job: KernelJob): JobView {
  return {
    ...job,
    id: job.id.toString(),
    budget: job.budget.toString(),
  }
}

export async function listJobs(limit = 50): Promise<JobView[]> {
  return (await (await kernel()).listJobs({ limit })).map(toView)
}

export async function jobCount(): Promise<number> {
  return Number(await (await kernel()).jobCount())
}

export async function getJob(id: string): Promise<JobView | null> {
  if (!/^[1-9]\d{0,19}$/.test(id)) return null
  const job = await (await kernel()).getJob(BigInt(id))
  return job ? toView(job) : null
}

export type Role = "client" | "provider" | "evaluator"

export interface AgentView {
  address: string
  roles: Role[]
  jobs: number
  completed: number
  rejected: number
  earned: string
  spent: string
}

export function deriveAgents(jobs: JobView[]): AgentView[] {
  const agents = new Map<
    string,
    Omit<AgentView, "roles" | "earned" | "spent"> & {
      roles: Set<Role>
      earned: bigint
      spent: bigint
    }
  >()
  const touch = (address: string | null, role: Role, job: JobView) => {
    if (!address) return
    const a = agents.get(address) ?? {
      address,
      roles: new Set<Role>(),
      jobs: 0,
      completed: 0,
      rejected: 0,
      earned: 0n,
      spent: 0n,
    }
    a.roles.add(role)
    a.jobs++
    if (job.status === "completed") {
      a.completed++
      if (role === "provider") a.earned += BigInt(job.budget)
      if (role === "client") a.spent += BigInt(job.budget)
    }
    if (job.status === "rejected") a.rejected++
    agents.set(address, a)
  }
  for (const job of jobs) {
    touch(job.client, "client", job)
    touch(job.provider, "provider", job)
    touch(job.evaluator, "evaluator", job)
  }
  return [...agents.values()]
    .map((a) => ({
      ...a,
      roles: [...a.roles],
      earned: a.earned.toString(),
      spent: a.spent.toString(),
    }))
    .sort((x, y) => y.jobs - x.jobs || y.completed - x.completed)
}

const FRIENDLY: Record<string, string> = {
  NotFound: "That job does not exist.",
  BadState: "The job is not in a state that allows this action.",
  BadActor: "Your wallet is not allowed to do this on this job.",
  BadExpiry: "The expiry must be in the future and at most 90 days away.",
  Expired: "The job has expired. Only a refund is possible now.",
  NotExpired: "The job has not expired yet.",
  BadBudget: "The budget must be greater than zero.",
  BudgetMismatch:
    "The budget changed since you loaded the page. Reload and check it.",
  NoProvider: "Set a provider before funding.",
  ProviderAlreadySet: "This job already has a provider.",
  RoleConflict:
    "Client, provider and evaluator must be three different wallets.",
  IdOverflow: "The kernel cannot create more jobs.",
  NotSigner: "This wallet is not an evaluation policy signer.",
}

export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const known = contractError(message)
  if (known?.code === 13) {
    return "Not enough USDC, or the wallet has no USDC trustline."
  }
  if (known) {
    return FRIENDLY[known.name] ?? `Contract error #${known.code}`
  }
  if (
    /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Cannot reach/i.test(message)
  ) {
    return "Could not reach Stellar testnet. Try again in a moment."
  }
  if (/Account not found/i.test(message)) {
    return "This wallet has no testnet account yet. Fund it with Friendbot first."
  }
  if (
    /resulting balance is not within the allowed range|trustline/i.test(message)
  ) {
    return "Not enough USDC, or the wallet has no USDC trustline."
  }
  if (error instanceof SimulationError) return message.split("\n")[0]!
  return message
}

const OTHER_SIGNER =
  "Your wallet is not the party who must sign this action on this job."

export async function prepareKernelCall(source: string, call: KernelCall) {
  const prepared = await prepareInvoke({
    rpc: await server(),
    networkPassphrase: DEPLOYMENT.networkPassphrase,
    source,
    contractId: DEPLOYMENT.kernel,
    method: call.method,
    args: kernelArgs(call),
  })
  const needsOtherSigner = prepared.authEntries.some(
    (entry) =>
      xdr.SorobanAuthorizationEntry.fromXDR(entry, "base64").credentials
        .type !== "sorobanCredentialsSourceAccount"
  )
  if (needsOtherSigner) throw new Error(OTHER_SIGNER)
  return {
    xdr: prepared.xdr,
    minResourceFee: prepared.minResourceFee.toString(),
  }
}

export type SubmitView =
  | { status: "success"; hash: string; ledger: number; value: string | null }
  | {
      status: "failed" | "rejected" | "try_again_later" | "unknown"
      hash: string
    }

export async function submitSigned(signedXdr: string): Promise<SubmitView> {
  const result = await submitAndWait(await server(), signedXdr, {
    networkPassphrase: DEPLOYMENT.networkPassphrase,
    timeoutMs: 45_000,
  })
  if (result.status === "success") {
    const native = result.returnValue ? scValToNative(result.returnValue) : null
    return {
      status: "success",
      hash: result.hash,
      ledger: result.ledger,
      value: typeof native === "bigint" ? native.toString() : null,
    }
  }
  return { status: result.status, hash: result.hash }
}

const XLM_SAC = sacContractId("XLM", undefined, DEPLOYMENT.networkPassphrase)

export interface BalancesView {
  usdc: string | null
  xlm: string | null
}

async function sacBalance(token: string, address: string) {
  try {
    const value = await simulateRead(
      await server(),
      DEPLOYMENT.networkPassphrase,
      token,
      "balance",
      [addressToScVal(address)]
    )
    return String(scValToNative(value))
  } catch (error) {
    if (
      contractError(error instanceof Error ? error.message : "")?.code === 13
    ) {
      return null
    }
    throw error
  }
}

export async function getBalances(address: string): Promise<BalancesView> {
  const [usdc, xlm] = await Promise.all([
    sacBalance(DEPLOYMENT.token, address),
    sacBalance(XLM_SAC, address),
  ])
  return { usdc, xlm }
}
