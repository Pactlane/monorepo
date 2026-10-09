import { z } from "zod"

export const sha256RefSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/, "Expected sha256:<hex>")
export const atomicAmountSchema = z.string().regex(/^\d+$/, "Expected integer atomic units")
export const agentIdSchema = z.string().regex(/^stellar:(testnet|mainnet):[A-Z0-9]+#\d+$/)
export const stellarAddressSchema = z.string().regex(/^[GC][A-Z2-7]{55}$/)
export const unixSchema = z.number().int().nonnegative()
export const nonceSchema = z.string().min(16).max(128)

export const agentProfileSchema = z.object({
  schemaVersion: z.literal("pactlane.agent.v1"),
  agentId: agentIdSchema,
  displayName: z.string().min(1).max(80),
  description: z.string().max(500).default(""),
  ownerAddress: stellarAddressSchema,
  providerWallet: stellarAddressSchema,
  capabilities: z.array(z.string().min(1).max(48)).min(1).max(32),
  serviceEndpoint: z.url().optional(),
  axlPeerId: z.string().optional(),
  communicationKey: z.string().regex(/^[0-9a-f]{64}$/, "Expected hex ed25519 public key"),
  supportedAssets: z.array(z.string()).min(1),
  minBudgetAtomic: atomicAmountSchema,
  maxConcurrentJobs: z.number().int().positive(),
  evaluationPolicyIds: z.array(z.string()).default([]),
  metadataUri: z.string().optional(),
  metadataHash: sha256RefSchema.optional(),
})
export type AgentProfile = z.infer<typeof agentProfileSchema>

export const rubricCheckSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("required_sections"), sections: z.array(z.string()).min(1) }),
  z.object({ kind: z.literal("min_words"), value: z.number().int().positive() }),
  z.object({ kind: z.literal("max_words"), value: z.number().int().positive() }),
  z.object({ kind: z.literal("contains"), terms: z.array(z.string()).min(1) }),
  z.object({ kind: z.literal("format"), value: z.enum(["markdown", "json", "text"]) }),
])
export type RubricCheck = z.infer<typeof rubricCheckSchema>

export const taskSpecSchema = z.object({
  schemaVersion: z.literal("pactlane.task.v1"),
  title: z.string().min(1).max(140),
  requirements: z.string().min(1),
  capability: z.string().min(1),
  acceptedFormat: z.enum(["markdown", "json", "text"]),
  rubricId: z.string().min(1),
  rubric: z.array(rubricCheckSchema).min(1),
  allowedInputs: z.array(z.string()).default([]),
  deadlineUnix: unixSchema,
})
export type TaskSpec = z.infer<typeof taskSpecSchema>

export const quoteSchema = z.object({
  domain: z.literal("pactlane.quote.v1"),
  networkPassphrase: z.string(),
  providerAgentId: agentIdSchema,
  buyerAgentId: agentIdSchema,
  taskSpecHash: sha256RefSchema,
  priceAtomic: atomicAmountSchema,
  paymentAssetContractId: z.string().min(1),
  deliveryWithinSeconds: z.number().int().positive(),
  assumptions: z.array(z.string()).default([]),
  nonce: nonceSchema,
  expiresAtUnix: unixSchema,
})
export type Quote = z.infer<typeof quoteSchema>

export const agreementSchema = z.object({
  domain: z.literal("pactlane.negotiation.v1"),
  stellarNetworkPassphrase: z.string(),
  commerceContractId: z.string().min(1),
  buyerAgentId: agentIdSchema,
  providerAgentId: agentIdSchema,
  evaluatorAddress: stellarAddressSchema,
  taskSpecHash: sha256RefSchema,
  acceptedQuoteHash: sha256RefSchema,
  paymentAssetContractId: z.string().min(1),
  budgetAtomic: atomicAmountSchema,
  evaluationPolicyId: z.string().min(1),
  workDeadlineUnix: unixSchema,
  evaluationDeadlineUnix: unixSchema,
  nonce: nonceSchema,
  expiresAtUnix: unixSchema,
})
export type Agreement = z.infer<typeof agreementSchema>
