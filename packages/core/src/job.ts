import { z } from "zod"
import {
  agentIdSchema,
  atomicAmountSchema,
  sha256RefSchema,
  stellarAddressSchema,
  unixSchema,
} from "./schemas"

export const JOB_STATUSES = [
  "open",
  "funded",
  "submitted",
  "completed",
  "rejected",
  "expired",
] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const TERMINAL_STATUSES: readonly JobStatus[] = [
  "completed",
  "rejected",
  "expired",
]

export type JobAction =
  "fund" | "cancel" | "submit" | "complete" | "reject" | "expire"

const TRANSITIONS: Record<JobStatus, Partial<Record<JobAction, JobStatus>>> = {
  open: { fund: "funded", cancel: "rejected", expire: "expired" },
  funded: { submit: "submitted", reject: "rejected", expire: "expired" },
  submitted: { complete: "completed", reject: "rejected", expire: "expired" },
  completed: {},
  rejected: {},
  expired: {},
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: JobStatus,
    readonly action: JobAction
  ) {
    super(`Cannot ${action} a job in status ${from}`)
  }
}

export function nextStatus(from: JobStatus, action: JobAction): JobStatus {
  const to = TRANSITIONS[from][action]
  if (!to) throw new InvalidTransitionError(from, action)
  return to
}

export function canTransition(from: JobStatus, action: JobAction): boolean {
  return TRANSITIONS[from][action] !== undefined
}

export function isTerminal(status: JobStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export const deliverableSchema = z.object({
  schemaVersion: z.literal("pactlane.deliverable.v1"),
  jobId: z.string().min(1),
  providerAgentId: agentIdSchema,
  taskSpecHash: sha256RefSchema,
  format: z.enum(["markdown", "json", "text"]),
  files: z
    .array(
      z.object({
        name: z.string(),
        sha256: sha256RefSchema,
        uri: z.string(),
        bytes: z.number().int().nonnegative(),
      })
    )
    .min(1),
  submittedAtUnix: unixSchema,
})
export type Deliverable = z.infer<typeof deliverableSchema>

export const verdictSchema = z.enum(["pass", "fail", "needs_review"])
export type Verdict = z.infer<typeof verdictSchema>

export const evaluationBundleSchema = z.object({
  schemaVersion: z.literal("pactlane.evaluation.v1"),
  networkPassphrase: z.string(),
  commerceContractId: z.string().min(1),
  jobId: z.string().min(1),
  rubricId: z.string().min(1),
  taskSpecHash: sha256RefSchema,
  deliverableHash: sha256RefSchema,
  verdict: verdictSchema,
  checks: z.array(
    z.object({ kind: z.string(), passed: z.boolean(), detail: z.string() })
  ),
  reasoningHash: sha256RefSchema.optional(),
  evaluatorAddress: stellarAddressSchema,
  evaluationDeadlineUnix: unixSchema,
  evaluatedAtUnix: unixSchema,
  providerProof: z.unknown().optional(),
})
export type EvaluationBundle = z.infer<typeof evaluationBundleSchema>

export const jobEventSchema = z.object({
  type: z.enum([
    "created",
    "funded",
    "submitted",
    "completed",
    "rejected",
    "expired",
    "refunded",
  ]),
  ledger: z.number().int().nonnegative(),
  txHash: z.string(),
  atUnix: unixSchema,
  commitment: sha256RefSchema.optional(),
})
export type JobEvent = z.infer<typeof jobEventSchema>

export const jobSchema = z.object({
  id: z.string(),
  network: z.enum(["testnet", "mainnet"]),
  contractId: z.string(),
  onchainJobId: z.string(),
  title: z.string(),
  capability: z.string(),
  buyerAgentId: agentIdSchema,
  providerAgentId: agentIdSchema,
  evaluatorAddress: stellarAddressSchema,
  budgetAtomic: atomicAmountSchema,
  status: z.enum(JOB_STATUSES),
  taskSpecHash: sha256RefSchema,
  agreementHash: sha256RefSchema.optional(),
  deliverableHash: sha256RefSchema.optional(),
  evaluationHash: sha256RefSchema.optional(),
  workDeadlineUnix: unixSchema,
  evaluationDeadlineUnix: unixSchema,
  events: z.array(jobEventSchema),
  simulated: z.boolean(),
})
export type Job = z.infer<typeof jobSchema>
