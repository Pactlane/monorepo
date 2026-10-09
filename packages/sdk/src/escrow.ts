import { nextStatus, type JobStatus, type Sha256Ref } from "@pactlane/core"

export interface CreateJobParams {
  client: string
  provider: string
  evaluator: string
  budgetAtomic: bigint
  descriptionHash: Sha256Ref
  deadlineUnix: number
}

export interface EscrowJob extends CreateJobParams {
  id: string
  status: JobStatus
  deliverableHash?: Sha256Ref
  reasonHash?: Sha256Ref
}

export interface EscrowClient {
  createJob(p: CreateJobParams): Promise<string>
  fund(
    jobId: string,
    caller: string,
    expectedBudgetAtomic: bigint
  ): Promise<void>
  submit(
    jobId: string,
    caller: string,
    deliverableHash: Sha256Ref
  ): Promise<void>
  complete(jobId: string, caller: string, reasonHash: Sha256Ref): Promise<void>
  reject(jobId: string, caller: string, reasonHash: Sha256Ref): Promise<void>
  claimRefund(jobId: string, nowUnix: number): Promise<void>
  getJob(jobId: string): Promise<EscrowJob>
}

export class EscrowError extends Error {}

export class SimulatedEscrow implements EscrowClient {
  readonly simulated = true
  private jobs = new Map<string, EscrowJob>()
  private balances = new Map<string, bigint>()
  private held = new Map<string, bigint>()
  private seq = 0

  mint(address: string, amount: bigint) {
    this.balances.set(address, this.balanceOf(address) + amount)
  }

  balanceOf(address: string): bigint {
    return this.balances.get(address) ?? 0n
  }

  async createJob(p: CreateJobParams) {
    if (p.evaluator === p.provider)
      throw new EscrowError("evaluator cannot be the provider")
    if (p.budgetAtomic <= 0n) throw new EscrowError("budget must be positive")
    const id = String(++this.seq)
    this.jobs.set(id, { ...p, id, status: "open" })
    return id
  }

  private job(id: string) {
    const j = this.jobs.get(id)
    if (!j) throw new EscrowError(`unknown job ${id}`)
    return j
  }

  private payout(j: EscrowJob, to: string) {
    const amount = this.held.get(j.id) ?? 0n
    this.held.delete(j.id)
    this.balances.set(to, this.balanceOf(to) + amount)
  }

  async fund(jobId: string, caller: string, expected: bigint) {
    const j = this.job(jobId)
    if (caller !== j.client) throw new EscrowError("only the client can fund")
    if (expected !== j.budgetAtomic) throw new EscrowError("budget mismatch")
    const balance = this.balanceOf(caller)
    if (balance < expected) throw new EscrowError("insufficient balance")
    j.status = nextStatus(j.status, "fund")
    this.balances.set(caller, balance - expected)
    this.held.set(jobId, expected)
  }

  async submit(jobId: string, caller: string, deliverableHash: Sha256Ref) {
    const j = this.job(jobId)
    if (caller !== j.provider)
      throw new EscrowError("only the provider can submit")
    j.status = nextStatus(j.status, "submit")
    j.deliverableHash = deliverableHash
  }

  async complete(jobId: string, caller: string, reasonHash: Sha256Ref) {
    const j = this.job(jobId)
    if (caller !== j.evaluator)
      throw new EscrowError("only the evaluator can complete")
    j.status = nextStatus(j.status, "complete")
    j.reasonHash = reasonHash
    this.payout(j, j.provider)
  }

  async reject(jobId: string, caller: string, reasonHash: Sha256Ref) {
    const j = this.job(jobId)
    const allowed =
      caller === j.evaluator || (j.status === "open" && caller === j.client)
    if (!allowed) throw new EscrowError("not allowed to reject")
    j.status = nextStatus(j.status, j.status === "open" ? "cancel" : "reject")
    j.reasonHash = reasonHash
    this.payout(j, j.client)
  }

  async claimRefund(jobId: string, nowUnix: number) {
    const j = this.job(jobId)
    if (nowUnix <= j.deadlineUnix) throw new EscrowError("deadline not reached")
    j.status = nextStatus(j.status, "expire")
    this.payout(j, j.client)
  }

  async getJob(jobId: string) {
    return { ...this.job(jobId) }
  }
}
