import {
  NETWORKS,
  commit,
  sha256Ref,
  toAtomic,
  type AgentProfile,
  type Job,
  type JobEvent,
  type JobStatus,
  type TaskSpec,
} from "@pactlane/core"
import { fixtureContractId, fixtureIdentity } from "./keys"

export const NETWORK = NETWORKS.testnet
export const REGISTRY_ID = fixtureContractId("identity-registry")
export const COMMERCE_CONTRACT_ID = fixtureContractId("commerce-kernel")
export const USDC_CONTRACT_ID = fixtureContractId("usdc-sac")
export const BASE_TIME = 1_791_590_400

export const agentId = (index: number) =>
  `stellar:testnet:${REGISTRY_ID}#${index}`

interface AgentSeed {
  index: number
  label: string
  displayName: string
  description: string
  capabilities: string[]
  minBudget: string
}

const AGENT_SEEDS: AgentSeed[] = [
  {
    index: 1,
    label: "atlas",
    displayName: "Atlas",
    description:
      "Research buyer that commissions market analysis for its operator.",
    capabilities: ["research-buyer"],
    minBudget: "0.10",
  },
  {
    index: 2,
    label: "scout",
    displayName: "Research Scout",
    description:
      "Fast market reports with cited sources and a fixed structure.",
    capabilities: ["research", "market-report"],
    minBudget: "0.40",
  },
  {
    index: 3,
    label: "scribe",
    displayName: "Scribe",
    description:
      "Long-form analyst. Slower, deeper reports with appendix tables.",
    capabilities: ["research", "market-report", "writing"],
    minBudget: "0.55",
  },
  {
    index: 4,
    label: "linter",
    displayName: "Code Linter",
    description:
      "Static review of TypeScript and Rust repositories with a findings report.",
    capabilities: ["code-review", "repo-audit"],
    minBudget: "0.25",
  },
  {
    index: 5,
    label: "polyglot",
    displayName: "Polyglot",
    description:
      "Translates technical docs across 30 languages, preserving markdown.",
    capabilities: ["translation", "writing"],
    minBudget: "0.15",
  },
  {
    index: 6,
    label: "datawright",
    displayName: "Datawright",
    description: "Cleans CSV and JSON datasets against a declared schema.",
    capabilities: ["data-cleaning", "json"],
    minBudget: "0.20",
  },
]

export const judge = fixtureIdentity("judge")

export const identities = Object.fromEntries(
  AGENT_SEEDS.map((s) => [s.label, fixtureIdentity(s.label)])
) as Record<string, ReturnType<typeof fixtureIdentity>>

export const agents: AgentProfile[] = AGENT_SEEDS.map((s) => {
  const id = identities[s.label]!
  return {
    schemaVersion: "pactlane.agent.v1",
    agentId: agentId(s.index),
    displayName: s.displayName,
    description: s.description,
    ownerAddress: id.address,
    providerWallet: id.address,
    capabilities: s.capabilities,
    serviceEndpoint: `https://${s.label}.agents.pactlane.dev`,
    communicationKey: id.comm.publicKeyHex,
    supportedAssets: ["stellar-usdc-testnet"],
    minBudgetAtomic: toAtomic(s.minBudget).toString(),
    maxConcurrentJobs: 5,
    evaluationPolicyIds: ["default-v1"],
  }
})

export const agentByLabel = (label: string): AgentProfile =>
  agents[AGENT_SEEDS.findIndex((s) => s.label === label)]!

export const marketReportTask: TaskSpec = {
  schemaVersion: "pactlane.task.v1",
  title: "Market report: Stellar agent payments",
  requirements:
    "Summarize the agent payments landscape on Stellar in under 600 words.",
  capability: "market-report",
  acceptedFormat: "markdown",
  rubricId: "report-format-v1",
  rubric: [
    { kind: "format", value: "markdown" },
    { kind: "required_sections", sections: ["Summary", "Landscape", "Risks"] },
    { kind: "min_words", value: 80 },
    { kind: "max_words", value: 600 },
  ],
  allowedInputs: [],
  deadlineUnix: BASE_TIME + 86_400,
}

interface JobSeed {
  id: string
  title: string
  capability: string
  provider: string
  budget: string
  status: JobStatus
  offset: number
}

const JOB_SEEDS: JobSeed[] = [
  {
    id: "job-0001",
    title: "Market report",
    capability: "market-report",
    provider: "scout",
    budget: "0.40",
    status: "completed",
    offset: 0,
  },
  {
    id: "job-0002",
    title: "Repo audit",
    capability: "repo-audit",
    provider: "linter",
    budget: "0.25",
    status: "funded",
    offset: 3_600,
  },
  {
    id: "job-0003",
    title: "Docs translation (ES)",
    capability: "translation",
    provider: "polyglot",
    budget: "0.15",
    status: "submitted",
    offset: 7_200,
  },
  {
    id: "job-0004",
    title: "Dataset cleanup",
    capability: "data-cleaning",
    provider: "datawright",
    budget: "0.20",
    status: "rejected",
    offset: 10_800,
  },
  {
    id: "job-0005",
    title: "Competitor brief",
    capability: "market-report",
    provider: "scribe",
    budget: "0.55",
    status: "open",
    offset: 14_400,
  },
  {
    id: "job-0006",
    title: "Weekly digest",
    capability: "writing",
    provider: "scribe",
    budget: "0.30",
    status: "expired",
    offset: 18_000,
  },
]

const LIFECYCLE: Record<JobStatus, JobEvent["type"][]> = {
  open: ["created"],
  funded: ["created", "funded"],
  submitted: ["created", "funded", "submitted"],
  completed: ["created", "funded", "submitted", "completed"],
  rejected: ["created", "funded", "submitted", "rejected", "refunded"],
  expired: ["created", "funded", "expired", "refunded"],
}

function fakeTx(jobId: string, type: string): string {
  return sha256Ref(`${jobId}:${type}`).slice(7)
}

export const jobs: Job[] = JOB_SEEDS.map((s, i) => {
  const start = BASE_TIME + s.offset
  const task = { ...marketReportTask, title: s.title, capability: s.capability }
  const taskSpecHash = commit("pactlane.task.v1", task)
  const events = LIFECYCLE[s.status].map((type, n) => {
    const event: JobEvent = {
      type,
      ledger: 1_200_000 + i * 100 + n * 7,
      txHash: fakeTx(s.id, type),
      atUnix: start + n * 900,
    }
    if (type === "created") event.commitment = taskSpecHash
    if (type === "submitted")
      event.commitment = sha256Ref(`${s.id}:deliverable`)
    if (type === "completed" || type === "rejected")
      event.commitment = sha256Ref(`${s.id}:evaluation`)
    return event
  })
  const reached = (t: JobEvent["type"]) => events.some((e) => e.type === t)
  return {
    id: s.id,
    network: "testnet",
    contractId: COMMERCE_CONTRACT_ID,
    onchainJobId: String(i + 1),
    title: s.title,
    capability: s.capability,
    buyerAgentId: agentId(1),
    providerAgentId: agentByLabel(s.provider).agentId,
    evaluatorAddress: judge.address,
    budgetAtomic: toAtomic(s.budget).toString(),
    status: s.status,
    taskSpecHash,
    agreementHash: sha256Ref(`${s.id}:agreement`),
    deliverableHash: reached("submitted")
      ? sha256Ref(`${s.id}:deliverable`)
      : undefined,
    evaluationHash:
      reached("completed") || reached("rejected")
        ? sha256Ref(`${s.id}:evaluation`)
        : undefined,
    workDeadlineUnix: start + 86_400,
    evaluationDeadlineUnix: start + 90_000,
    events,
    simulated: true,
  }
})
