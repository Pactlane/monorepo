import {
  agreementSchema,
  commit,
  quoteSchema,
  type Agreement,
  type Quote,
  type Sha256Ref,
} from "@pactlane/core"
import { verifyEnvelope, type SignedEnvelope } from "./envelope"
import { replayKey, type NonceStore } from "./replay"

export interface NegotiationContext {
  networkPassphrase: string
  commerceContractId: string
  paymentAssetContractId: string
  nowUnix: number
  nonces: NonceStore
}

export interface BuyerPolicy {
  maxBudgetAtomic: bigint
  trustedEvaluatorPolicyIds: string[]
  blockedProviders?: string[]
  humanApprovalAboveAtomic?: bigint
}

export class NegotiationError extends Error {}

async function consumeNonce(ctx: NegotiationContext, sender: string, nonce: string, domain: string, expires: number) {
  const key = replayKey(sender, nonce, domain)
  if (await ctx.nonces.has(key)) throw new NegotiationError("nonce already used")
  await ctx.nonces.add(key, expires)
}

export async function acceptQuote(
  envelope: SignedEnvelope<Quote>,
  providerPublicKey: string,
  ctx: NegotiationContext,
  policy: BuyerPolicy
): Promise<{ quote: Quote; quoteHash: Sha256Ref; needsHumanApproval: boolean }> {
  const check = verifyEnvelope(envelope, providerPublicKey)
  if (!check.ok) throw new NegotiationError(check.reason)
  const quote = quoteSchema.parse(envelope.payload)
  if (envelope.sender !== quote.providerAgentId) throw new NegotiationError("sender is not the quoting provider")
  if (quote.networkPassphrase !== ctx.networkPassphrase) throw new NegotiationError("network mismatch")
  if (quote.paymentAssetContractId !== ctx.paymentAssetContractId) throw new NegotiationError("asset mismatch")
  if (quote.expiresAtUnix <= ctx.nowUnix) throw new NegotiationError("quote expired")
  if (policy.blockedProviders?.includes(quote.providerAgentId)) throw new NegotiationError("provider blocked by policy")
  const price = BigInt(quote.priceAtomic)
  if (price <= 0n) throw new NegotiationError("price must be positive")
  if (price > policy.maxBudgetAtomic) throw new NegotiationError("price exceeds buyer budget")
  await consumeNonce(ctx, envelope.sender, quote.nonce, quote.domain, quote.expiresAtUnix)
  return {
    quote,
    quoteHash: envelope.payloadHash,
    needsHumanApproval: policy.humanApprovalAboveAtomic !== undefined && price > policy.humanApprovalAboveAtomic,
  }
}

export async function validateAgreement(
  envelope: SignedEnvelope<Agreement>,
  signerPublicKey: string,
  ctx: NegotiationContext,
  opts: { providerWallet: string; acceptedQuote: Quote }
): Promise<{ agreement: Agreement; agreementHash: Sha256Ref }> {
  const check = verifyEnvelope(envelope, signerPublicKey)
  if (!check.ok) throw new NegotiationError(check.reason)
  const a = agreementSchema.parse(envelope.payload)
  if (a.stellarNetworkPassphrase !== ctx.networkPassphrase) throw new NegotiationError("network mismatch")
  if (a.commerceContractId !== ctx.commerceContractId) throw new NegotiationError("commerce contract mismatch")
  if (a.paymentAssetContractId !== ctx.paymentAssetContractId) throw new NegotiationError("asset mismatch")
  if (a.expiresAtUnix <= ctx.nowUnix) throw new NegotiationError("agreement expired")
  if (a.evaluatorAddress === opts.providerWallet) throw new NegotiationError("evaluator cannot be the provider")
  if (a.workDeadlineUnix >= a.evaluationDeadlineUnix) throw new NegotiationError("evaluation deadline must follow work deadline")
  if (a.acceptedQuoteHash !== commit("pactlane.quote.v1", opts.acceptedQuote)) throw new NegotiationError("accepted quote hash mismatch")
  if (a.budgetAtomic !== opts.acceptedQuote.priceAtomic) throw new NegotiationError("budget differs from accepted quote")
  if (a.taskSpecHash !== opts.acceptedQuote.taskSpecHash) throw new NegotiationError("task differs from accepted quote")
  await consumeNonce(ctx, envelope.sender, a.nonce, a.domain, a.expiresAtUnix)
  return { agreement: a, agreementHash: envelope.payloadHash }
}
