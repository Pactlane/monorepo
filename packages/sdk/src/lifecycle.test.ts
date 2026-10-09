import { beforeEach, describe, expect, test } from "bun:test"
import { NETWORKS, toAtomic, type TaskSpec } from "@pactlane/core"
import { MemoryAgentDirectory } from "@pactlane/discovery"
import { LocalHub, MemoryNonceStore, type NegotiationContext } from "@pactlane/negotiation"
import { MemoryEvidenceStore } from "@pactlane/storage-0g"
import {
  BASE_TIME,
  COMMERCE_CONTRACT_ID,
  USDC_CONTRACT_ID,
  agentByLabel,
  fixtureIdentity,
  judge,
  marketReportTask,
} from "@pactlane/test-utils"
import { SimulatedEscrow } from "./escrow"
import { BuyerAgent, EvaluatorAgent, ProviderAgent, type Identity } from "./roles"

const filler = Array.from({ length: 40 }, (_, i) => `point${i}`).join(" ")
const goodReport = `# Summary\n${filler}\n## Landscape\n${filler}\n## Risks\n${filler}`

const ident = (label: string): Identity => {
  const f = fixtureIdentity(label)
  return { agentId: agentByLabel(label).agentId, address: f.address, comm: f.comm }
}

function setup() {
  const ctx: NegotiationContext = {
    networkPassphrase: NETWORKS.testnet.passphrase,
    commerceContractId: COMMERCE_CONTRACT_ID,
    paymentAssetContractId: USDC_CONTRACT_ID,
    nowUnix: BASE_TIME,
    nonces: new MemoryNonceStore(),
  }
  const escrow = new SimulatedEscrow()
  const store = new MemoryEvidenceStore()
  const deps = { ctx, escrow, store }
  const hub = new LocalHub()
  const listing = (label: string) => ({ profile: agentByLabel(label), provenance: "chain-verified" as const, endpointActive: true, completedJobs: 0, rejectedJobs: 0 })
  const directory = new MemoryAgentDirectory([listing("scout"), listing("scribe")])
  const atlas = ident("atlas")
  const buyer = new BuyerAgent(atlas, deps, hub.connect(atlas.agentId), directory, { maxBudgetAtomic: toAtomic("0.50"), trustedEvaluatorPolicyIds: ["default-v1"] })
  const scout = new ProviderAgent(ident("scout"), deps, hub.connect(ident("scout").agentId), () => toAtomic("0.40"))
  const scribe = new ProviderAgent(ident("scribe"), deps, hub.connect(ident("scribe").agentId), () => toAtomic("0.55"))
  const evaluator = new EvaluatorAgent(judge.address, deps)
  escrow.mint(atlas.address, toAtomic("1"))
  return { escrow, buyer, scout, scribe, evaluator, atlas }
}

async function runTo(report: string) {
  const s = setup()
  await Promise.all([s.buyer.listen(), s.scout.listen(), s.scribe.listen()])
  const providers = await s.buyer.discover("market-report")
  const quotes = await s.buyer.requestQuotes(marketReportTask, providers)
  const best = quotes[0]!
  const funded = await s.buyer.createAndFund({ task: marketReportTask, ...best, evaluatorAddress: judge.address, evaluationPolicyId: "default-v1" })
  const deliverable = await s.scout.deliver(funded.jobId, () => report, marketReportTask as TaskSpec)
  const result = await s.evaluator.evaluate({
    jobId: funded.jobId,
    task: marketReportTask,
    deliverable,
    providerWallet: best.provider.profile.providerWallet,
    evaluationDeadlineUnix: funded.agreement.evaluationDeadlineUnix,
  })
  return { ...s, quotes, funded, result }
}

describe("three-agent lifecycle (simulation)", () => {
  test("cheapest in-budget quote wins and provider is paid on pass", async () => {
    const r = await runTo(goodReport)
    expect(r.quotes).toHaveLength(1)
    expect(r.quotes[0]!.provider.profile.displayName).toBe("Research Scout")
    expect(r.result.verdict).toBe("pass")
    expect((await r.escrow.getJob(r.funded.jobId)).status).toBe("completed")
    expect(r.escrow.balanceOf(fixtureIdentity("scout").address)).toBe(toAtomic("0.40"))
    expect(r.escrow.balanceOf(r.atlas.address)).toBe(toAtomic("0.60"))
  })

  test("failing deliverable refunds the buyer exactly once", async () => {
    const r = await runTo("# Summary\ntoo short")
    expect(r.result.verdict).toBe("fail")
    expect((await r.escrow.getJob(r.funded.jobId)).status).toBe("rejected")
    expect(r.escrow.balanceOf(r.atlas.address)).toBe(toAtomic("1"))
    await expect(r.escrow.claimRefund(r.funded.jobId, BASE_TIME + 999_999)).rejects.toThrow()
  })
})

describe("simulated escrow guards", () => {
  let escrow: SimulatedEscrow
  beforeEach(() => {
    escrow = new SimulatedEscrow()
    escrow.mint("client", 100n)
  })

  test("budget race and unauthorized callers fail", async () => {
    const id = await escrow.createJob({ client: "client", provider: "p", evaluator: "e", budgetAtomic: 10n, descriptionHash: `sha256:${"0".repeat(64)}`, deadlineUnix: 100 })
    await expect(escrow.fund(id, "client", 11n)).rejects.toThrow(/budget/)
    await escrow.fund(id, "client", 10n)
    await expect(escrow.submit(id, "mallory", `sha256:${"1".repeat(64)}`)).rejects.toThrow(/provider/)
    await escrow.submit(id, "p", `sha256:${"1".repeat(64)}`)
    await expect(escrow.complete(id, "p", `sha256:${"2".repeat(64)}`)).rejects.toThrow(/evaluator/)
    await expect(escrow.claimRefund(id, 100)).rejects.toThrow(/deadline/)
    await escrow.claimRefund(id, 101)
    expect(escrow.balanceOf("client")).toBe(100n)
  })

  test("evaluator equal to provider is refused", async () => {
    await expect(escrow.createJob({ client: "c", provider: "x", evaluator: "x", budgetAtomic: 1n, descriptionHash: `sha256:${"0".repeat(64)}`, deadlineUnix: 1 })).rejects.toThrow()
  })
})
