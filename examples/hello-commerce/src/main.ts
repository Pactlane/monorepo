import { NETWORKS, formatUsdc, toAtomic } from "@pactlane/core"
import { MemoryAgentDirectory, type AgentListing } from "@pactlane/discovery"
import { LocalHub, MemoryNonceStore } from "@pactlane/negotiation"
import {
  BuyerAgent,
  EvaluatorAgent,
  ProviderAgent,
  SimulatedEscrow,
  type Identity,
} from "@pactlane/sdk"
import { MemoryEvidenceStore } from "@pactlane/storage-0g"
import {
  BASE_TIME,
  COMMERCE_CONTRACT_ID,
  USDC_CONTRACT_ID,
  agentByLabel,
  fixtureIdentity,
  judge,
  marketReportTask as task,
} from "@pactlane/test-utils"

const log = (step: string, msg: string) =>
  console.log(`  ${step.padEnd(10)} ${msg}`)
const short = (h: string) => `${h.slice(0, 15)}…${h.slice(-6)}`

const identity = (label: string): Identity => {
  const f = fixtureIdentity(label)
  return {
    agentId: agentByLabel(label).agentId,
    address: f.address,
    comm: f.comm,
  }
}

const deps = {
  ctx: {
    networkPassphrase: NETWORKS.testnet.passphrase,
    commerceContractId: COMMERCE_CONTRACT_ID,
    paymentAssetContractId: USDC_CONTRACT_ID,
    nowUnix: BASE_TIME,
    nonces: new MemoryNonceStore(),
  },
  escrow: new SimulatedEscrow(),
  store: new MemoryEvidenceStore(),
}

const listing = (label: string): AgentListing => ({
  profile: agentByLabel(label),
  provenance: "chain-verified",
  endpointActive: true,
  completedJobs: 0,
  rejectedJobs: 0,
})

const hub = new LocalHub()
const atlas = identity("atlas")
const buyer = new BuyerAgent(
  atlas,
  deps,
  hub.connect(atlas.agentId),
  new MemoryAgentDirectory([listing("scout"), listing("scribe")]),
  {
    maxBudgetAtomic: toAtomic("0.40"),
    trustedEvaluatorPolicyIds: ["default-v1"],
  }
)
const scout = new ProviderAgent(
  identity("scout"),
  deps,
  hub.connect(identity("scout").agentId),
  () => toAtomic("0.40")
)
const scribe = new ProviderAgent(
  identity("scribe"),
  deps,
  hub.connect(identity("scribe").agentId),
  () => toAtomic("0.55")
)
const evaluator = new EvaluatorAgent(judge.address, deps)

const report = `# Summary
Agent payments on Stellar combine Soroban escrow with USDC settlement so software agents can hire each other with enforceable terms.

## Landscape
Stellar-8183 provides a job escrow kernel, Stellar-8004 provides agent identity and reputation, and x402 covers per-request payments. Pactlane composes these into a single negotiate-escrow-settle flow, with evidence stored on 0G and private negotiation over Gensyn AXL.

## Risks
The escrow kernel is unaudited and testnet-only. Evaluator verdicts are accountable but not trustless, and reputation is advisory rather than proof of identity.`

deps.escrow.mint(atlas.address, toAtomic("1"))

console.log(
  "\n  PACTLANE · hello-commerce   [SIMULATION — no real funds move]\n"
)
await Promise.all([buyer.listen(), scout.listen(), scribe.listen()])

const providers = await buyer.discover(task.capability)
log("discover", providers.map((p) => p.profile.displayName).join(", "))

const quotes = await buyer.requestQuotes(task, providers)
log(
  "negotiate",
  `${quotes.length} quote(s) within ${formatUsdc(buyer.policy.maxBudgetAtomic)}`
)
const best = quotes[0]
if (!best) throw new Error("no acceptable quote")
log(
  "accept",
  `${best.provider.profile.displayName} @ ${formatUsdc(best.quote.priceAtomic)}  quote ${short(best.quoteHash)}`
)

const funded = await buyer.createAndFund({
  task,
  ...best,
  evaluatorAddress: judge.address,
  evaluationPolicyId: "default-v1",
})
log(
  "escrow",
  `job #${funded.jobId} funded  agreement ${short(funded.agreementHash)}`
)

const deliverable = await scout.deliver(funded.jobId, () => report, task)
log("deliver", `deliverable ${short(deliverable.storedSha256)}`)

const result = await evaluator.evaluate({
  jobId: funded.jobId,
  task,
  deliverable,
  providerWallet: best.provider.profile.providerWallet,
  evaluationDeadlineUnix: funded.agreement.evaluationDeadlineUnix,
})
for (const c of result.checks)
  log("", `${c.passed ? "✓" : "✗"} ${c.kind}: ${c.detail}`)

const job = await deps.escrow.getJob(funded.jobId)
log(
  "settle",
  `${result.verdict.toUpperCase()} → job ${job.status}  evaluation ${short(result.bundleHash)}`
)
log(
  "balances",
  `Atlas ${formatUsdc(deps.escrow.balanceOf(atlas.address))} · Scout ${formatUsdc(deps.escrow.balanceOf(fixtureIdentity("scout").address))}`
)
console.log()
