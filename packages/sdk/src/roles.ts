import {
  commit,
  randomNonce,
  sha256Ref,
  type Agreement,
  type Ed25519KeyPair,
  type Quote,
  type Sha256Ref,
  type TaskSpec,
} from "@pactlane/core"
import type { AgentDirectory, AgentListing } from "@pactlane/discovery"
import { evaluateDeliverable, type CheckResult } from "@pactlane/evaluation"
import {
  acceptQuote,
  signEnvelope,
  type BuyerPolicy,
  type NegotiationContext,
  type NegotiationTransport,
  type SignedEnvelope,
} from "@pactlane/negotiation"
import { getVerified, type EvidenceStore, type StoredArtifact } from "@pactlane/storage-0g"
import type { EscrowClient } from "./escrow"

export interface Identity {
  agentId: string
  address: string
  comm: Ed25519KeyPair
}

export interface RoleDeps {
  ctx: NegotiationContext
  escrow: EscrowClient
  store: EvidenceStore
}

interface Rfq {
  task: TaskSpec
  taskSpecHash: Sha256Ref
  buyerAgentId: string
  replyTo: string
}

export class ProviderAgent {
  private tasks = new Map<Sha256Ref, TaskSpec>()

  constructor(
    readonly identity: Identity,
    private deps: RoleDeps,
    private transport: NegotiationTransport,
    private pricing: (task: TaskSpec) => bigint | null
  ) {}

  async listen() {
    await this.transport.receive(async (env) => {
      if (env.domain !== "pactlane.rfq.v1") return
      const rfq = env.payload as Rfq
      const price = this.pricing(rfq.task)
      if (price === null) return
      this.tasks.set(rfq.taskSpecHash, rfq.task)
      const quote: Quote = {
        domain: "pactlane.quote.v1",
        networkPassphrase: this.deps.ctx.networkPassphrase,
        providerAgentId: this.identity.agentId,
        buyerAgentId: rfq.buyerAgentId,
        taskSpecHash: rfq.taskSpecHash,
        priceAtomic: price.toString(),
        paymentAssetContractId: this.deps.ctx.paymentAssetContractId,
        deliveryWithinSeconds: 3600,
        assumptions: [],
        nonce: randomNonce(),
        expiresAtUnix: this.deps.ctx.nowUnix + 600,
      }
      await this.transport.send(rfq.replyTo, signEnvelope("pactlane.quote.v1", this.identity.agentId, this.identity.comm, quote))
    })
  }

  async deliver(jobId: string, work: (task: TaskSpec) => Promise<string> | string, task: TaskSpec) {
    const job = await this.deps.escrow.getJob(jobId)
    if (job.status !== "funded") throw new Error("refusing to work on an unfunded job")
    const bytes = new TextEncoder().encode(await work(task))
    const artifact = await this.deps.store.put("result", bytes)
    await this.deps.escrow.submit(jobId, this.identity.address, artifact.storedSha256)
    return artifact
  }
}

export interface FundedJob {
  jobId: string
  quote: Quote
  quoteHash: Sha256Ref
  agreement: Agreement
  agreementHash: Sha256Ref
  taskArtifact: StoredArtifact
}

export class BuyerAgent {
  private inbox: SignedEnvelope<Quote>[] = []

  constructor(
    readonly identity: Identity,
    private deps: RoleDeps,
    private transport: NegotiationTransport,
    private directory: AgentDirectory,
    readonly policy: BuyerPolicy
  ) {}

  async listen() {
    await this.transport.receive(async (env) => {
      if (env.domain === "pactlane.quote.v1") this.inbox.push(env as SignedEnvelope<Quote>)
    })
  }

  discover(capability: string) {
    return this.directory.search({ capability, verifiedOnly: true })
  }

  async requestQuotes(task: TaskSpec, providers: AgentListing[]) {
    const taskSpecHash = commit("pactlane.task.v1", task)
    const rfq: Rfq = { task, taskSpecHash, buyerAgentId: this.identity.agentId, replyTo: this.transport.peerId }
    const env = signEnvelope("pactlane.rfq.v1", this.identity.agentId, this.identity.comm, rfq)
    for (const p of providers) await this.transport.send(p.profile.agentId, env)
    const received = this.inbox.filter((q) => q.payload.taskSpecHash === taskSpecHash)
    const valid: { quote: Quote; quoteHash: Sha256Ref; provider: AgentListing }[] = []
    for (const envelope of received) {
      const provider = providers.find((p) => p.profile.agentId === envelope.sender)
      if (!provider) continue
      try {
        const res = await acceptQuote(envelope, provider.profile.communicationKey, this.deps.ctx, this.policy)
        valid.push({ ...res, provider })
      } catch {
        continue
      }
    }
    return valid.sort((a, b) => (BigInt(a.quote.priceAtomic) < BigInt(b.quote.priceAtomic) ? -1 : 1))
  }

  async createAndFund(opts: {
    task: TaskSpec
    quote: Quote
    quoteHash: Sha256Ref
    provider: AgentListing
    evaluatorAddress: string
    evaluationPolicyId: string
  }): Promise<FundedJob> {
    const { task, quote, provider } = opts
    const taskBytes = new TextEncoder().encode(JSON.stringify(task))
    const taskArtifact = await this.deps.store.put("task", taskBytes)
    const workDeadline = this.deps.ctx.nowUnix + quote.deliveryWithinSeconds
    const agreement: Agreement = {
      domain: "pactlane.negotiation.v1",
      stellarNetworkPassphrase: this.deps.ctx.networkPassphrase,
      commerceContractId: this.deps.ctx.commerceContractId,
      buyerAgentId: this.identity.agentId,
      providerAgentId: provider.profile.agentId,
      evaluatorAddress: opts.evaluatorAddress,
      taskSpecHash: quote.taskSpecHash,
      acceptedQuoteHash: opts.quoteHash,
      paymentAssetContractId: quote.paymentAssetContractId,
      budgetAtomic: quote.priceAtomic,
      evaluationPolicyId: opts.evaluationPolicyId,
      workDeadlineUnix: workDeadline,
      evaluationDeadlineUnix: workDeadline + 3600,
      nonce: randomNonce(),
      expiresAtUnix: this.deps.ctx.nowUnix + 600,
    }
    const agreementHash = commit("pactlane.negotiation.v1", agreement)
    const jobId = await this.deps.escrow.createJob({
      client: this.identity.address,
      provider: provider.profile.providerWallet,
      evaluator: opts.evaluatorAddress,
      budgetAtomic: BigInt(quote.priceAtomic),
      descriptionHash: agreementHash,
      deadlineUnix: agreement.evaluationDeadlineUnix,
    })
    await this.deps.escrow.fund(jobId, this.identity.address, BigInt(quote.priceAtomic))
    return { jobId, quote, quoteHash: opts.quoteHash, agreement, agreementHash, taskArtifact }
  }
}

export class EvaluatorAgent {
  constructor(
    readonly address: string,
    private deps: RoleDeps
  ) {}

  async evaluate(opts: { jobId: string; task: TaskSpec; deliverable: StoredArtifact; providerWallet: string; evaluationDeadlineUnix: number }) {
    const job = await this.deps.escrow.getJob(opts.jobId)
    if (job.status !== "submitted") throw new Error(`job ${opts.jobId} is ${job.status}, not submitted`)
    if (job.deliverableHash !== opts.deliverable.storedSha256) throw new Error("deliverable differs from on-chain commitment")
    const bytes = await getVerified(this.deps.store, opts.deliverable)
    const { bundle, bundleHash } = evaluateDeliverable({
      task: opts.task,
      deliverableBytes: bytes,
      deliverableHash: sha256Ref(bytes),
      jobId: opts.jobId,
      networkPassphrase: this.deps.ctx.networkPassphrase,
      commerceContractId: this.deps.ctx.commerceContractId,
      evaluatorAddress: this.address,
      providerWallet: opts.providerWallet,
      evaluationDeadlineUnix: opts.evaluationDeadlineUnix,
      nowUnix: this.deps.ctx.nowUnix,
    })
    await this.deps.store.put("evaluation", new TextEncoder().encode(JSON.stringify(bundle)))
    if (bundle.verdict === "pass") await this.deps.escrow.complete(opts.jobId, this.address, bundleHash)
    else if (bundle.verdict === "fail") await this.deps.escrow.reject(opts.jobId, this.address, bundleHash)
    return { verdict: bundle.verdict, checks: bundle.checks as CheckResult[], bundleHash }
  }
}
