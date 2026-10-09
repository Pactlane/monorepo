import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

const id = () => uuid("id").primaryKey().defaultRandom()
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow()

export const networkEnum = pgEnum("network", ["testnet", "mainnet"])
export const jobStatusEnum = pgEnum("job_status", ["open", "funded", "submitted", "completed", "rejected", "expired"])
export const artifactKindEnum = pgEnum("artifact_kind", ["task", "result", "evaluation", "transcript"])

export const accounts = pgTable("accounts", {
  id: id(),
  stellarAddress: text("stellar_address").notNull().unique(),
  createdAt: createdAt(),
})

export const agentProfiles = pgTable(
  "agent_profiles",
  {
    id: id(),
    registryId: text("registry_id").notNull(),
    agentId: text("agent_id").notNull().unique(),
    ownerAddress: text("owner_address").notNull(),
    displayName: text("display_name").notNull(),
    metadataHash: text("metadata_hash"),
    profile: jsonb("profile").notNull(),
    verified: boolean("verified").notNull().default(false),
    lastVerifiedLedger: bigint("last_verified_ledger", { mode: "number" }),
    createdAt: createdAt(),
  },
  (t) => [index("agent_profiles_owner_idx").on(t.ownerAddress)]
)

export const agentCapabilities = pgTable(
  "agent_capabilities",
  {
    agentId: text("agent_id").notNull().references(() => agentProfiles.agentId),
    capability: text("capability").notNull(),
    domain: text("domain"),
  },
  (t) => [primaryKey({ columns: [t.agentId, t.capability] }), index("agent_capabilities_cap_idx").on(t.capability)]
)

export const agentEndpoints = pgTable("agent_endpoints", {
  id: id(),
  agentId: text("agent_id").notNull().references(() => agentProfiles.agentId),
  transport: text("transport").notNull(),
  endpoint: text("endpoint").notNull(),
  healthy: boolean("healthy").notNull().default(false),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
})

export const negotiations = pgTable("negotiations", {
  id: id(),
  buyerAgent: text("buyer_agent").notNull(),
  providerAgent: text("provider_agent").notNull(),
  transcriptRoot: text("transcript_root"),
  status: text("status").notNull(),
  createdAt: createdAt(),
})

export const quotes = pgTable("quotes", {
  id: id(),
  negotiationId: uuid("negotiation_id").notNull().references(() => negotiations.id),
  signedPayloadHash: text("signed_payload_hash").notNull().unique(),
  amountAtomic: text("amount_atomic").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
})

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    network: networkEnum("network").notNull(),
    contractId: text("contract_id").notNull(),
    onchainJobId: text("onchain_job_id").notNull(),
    title: text("title").notNull(),
    buyer: text("buyer").notNull(),
    provider: text("provider").notNull(),
    evaluator: text("evaluator").notNull(),
    budgetAtomic: text("budget_atomic").notNull(),
    status: jobStatusEnum("status").notNull(),
    taskSpecHash: text("task_spec_hash").notNull(),
    agreementHash: text("agreement_hash"),
    workDeadline: timestamp("work_deadline", { withTimezone: true }).notNull(),
    evaluationDeadline: timestamp("evaluation_deadline", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("jobs_chain_uidx").on(t.network, t.contractId, t.onchainJobId),
    index("jobs_status_idx").on(t.status, t.createdAt),
    index("jobs_provider_idx").on(t.provider),
    index("jobs_buyer_idx").on(t.buyer),
  ]
)

export const jobArtifacts = pgTable("job_artifacts", {
  id: id(),
  jobId: uuid("job_id").notNull().references(() => jobs.id),
  kind: artifactKindEnum("kind").notNull(),
  contentHash: text("content_hash").notNull(),
  uri: text("uri").notNull(),
  encrypted: boolean("encrypted").notNull().default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
})

export const jobEvents = pgTable(
  "job_events",
  {
    network: networkEnum("network").notNull(),
    txHash: text("tx_hash").notNull(),
    eventIndex: integer("event_index").notNull(),
    contractId: text("contract_id").notNull(),
    type: text("type").notNull(),
    ledger: bigint("ledger", { mode: "number" }).notNull(),
    payload: jsonb("payload").notNull(),
  },
  (t) => [primaryKey({ columns: [t.network, t.txHash, t.eventIndex] }), index("job_events_contract_ledger_idx").on(t.contractId, t.ledger)]
)

export const indexerCursors = pgTable("indexer_cursors", {
  network: networkEnum("network").primaryKey(),
  lastFinalizedLedger: bigint("last_finalized_ledger", { mode: "number" }).notNull(),
  lastTxHash: text("last_tx_hash"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const reputationSnapshots = pgTable("reputation_snapshots", {
  id: id(),
  agentId: text("agent_id").notNull(),
  registryId: text("registry_id").notNull(),
  ledger: bigint("ledger", { mode: "number" }).notNull(),
  score: integer("score").notNull(),
  provenance: text("provenance").notNull(),
})

export const workflowRuns = pgTable("workflow_runs", {
  id: id(),
  jobId: uuid("job_id").references(() => jobs.id),
  step: text("step").notNull(),
  attempt: integer("attempt").notNull().default(0),
  status: text("status").notNull(),
  nextRetry: timestamp("next_retry", { withTimezone: true }),
  idempotencyKey: text("idempotency_key").notNull().unique(),
})

export const apiSessions = pgTable("api_sessions", {
  id: id(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
})
