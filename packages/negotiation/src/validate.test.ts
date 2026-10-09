import { beforeEach, describe, expect, test } from "bun:test"
import { NETWORKS, commit, toAtomic, type Agreement, type Quote } from "@pactlane/core"
import {
  BASE_TIME,
  COMMERCE_CONTRACT_ID,
  USDC_CONTRACT_ID,
  agentId,
  fixtureIdentity,
  judge,
  marketReportTask,
} from "@pactlane/test-utils"
import { signEnvelope } from "./envelope"
import { MemoryNonceStore } from "./replay"
import { acceptQuote, validateAgreement, type NegotiationContext } from "./validate"

const scout = fixtureIdentity("scout")
const atlas = fixtureIdentity("atlas")
const policy = { maxBudgetAtomic: toAtomic("0.40"), trustedEvaluatorPolicyIds: ["default-v1"] }

const quote: Quote = {
  domain: "pactlane.quote.v1",
  networkPassphrase: NETWORKS.testnet.passphrase,
  providerAgentId: agentId(2),
  buyerAgentId: agentId(1),
  taskSpecHash: commit("pactlane.task.v1", marketReportTask),
  priceAtomic: toAtomic("0.40").toString(),
  paymentAssetContractId: USDC_CONTRACT_ID,
  deliveryWithinSeconds: 3600,
  assumptions: [],
  nonce: "quote-nonce-000001",
  expiresAtUnix: BASE_TIME + 600,
}

let ctx: NegotiationContext
beforeEach(() => {
  ctx = {
    networkPassphrase: NETWORKS.testnet.passphrase,
    commerceContractId: COMMERCE_CONTRACT_ID,
    paymentAssetContractId: USDC_CONTRACT_ID,
    nowUnix: BASE_TIME,
    nonces: new MemoryNonceStore(),
  }
})

const sign = (q: Quote) => signEnvelope("pactlane.quote.v1", q.providerAgentId, scout.comm, q)

describe("acceptQuote", () => {
  test("accepts a valid quote within budget", async () => {
    const res = await acceptQuote(sign(quote), scout.comm.publicKeyHex, ctx, policy)
    expect(res.quoteHash).toBe(commit("pactlane.quote.v1", quote))
  })

  test("rejects duplicate nonce", async () => {
    await acceptQuote(sign(quote), scout.comm.publicKeyHex, ctx, policy)
    await expect(acceptQuote(sign(quote), scout.comm.publicKeyHex, ctx, policy)).rejects.toThrow(/nonce/)
  })

  test("rejects a quote replayed on another network", async () => {
    const mainnetQuote = { ...quote, networkPassphrase: NETWORKS.mainnet.passphrase }
    await expect(acceptQuote(sign(mainnetQuote), scout.comm.publicKeyHex, ctx, policy)).rejects.toThrow(/network/)
  })

  test("rejects wrong asset, expired and over-budget quotes", async () => {
    await expect(acceptQuote(sign({ ...quote, paymentAssetContractId: "CFAKE" }), scout.comm.publicKeyHex, ctx, policy)).rejects.toThrow(/asset/)
    await expect(acceptQuote(sign({ ...quote, expiresAtUnix: BASE_TIME }), scout.comm.publicKeyHex, ctx, policy)).rejects.toThrow(/expired/)
    await expect(acceptQuote(sign({ ...quote, priceAtomic: "5500000" }), scout.comm.publicKeyHex, ctx, policy)).rejects.toThrow(/budget/)
  })

  test("flags human approval threshold", async () => {
    const res = await acceptQuote(sign(quote), scout.comm.publicKeyHex, ctx, { ...policy, humanApprovalAboveAtomic: toAtomic("0.10") })
    expect(res.needsHumanApproval).toBe(true)
  })
})

describe("validateAgreement", () => {
  const agreement: Agreement = {
    domain: "pactlane.negotiation.v1",
    stellarNetworkPassphrase: NETWORKS.testnet.passphrase,
    commerceContractId: COMMERCE_CONTRACT_ID,
    buyerAgentId: agentId(1),
    providerAgentId: agentId(2),
    evaluatorAddress: judge.address,
    taskSpecHash: quote.taskSpecHash,
    acceptedQuoteHash: commit("pactlane.quote.v1", quote),
    paymentAssetContractId: USDC_CONTRACT_ID,
    budgetAtomic: quote.priceAtomic,
    evaluationPolicyId: "default-v1",
    workDeadlineUnix: BASE_TIME + 3600,
    evaluationDeadlineUnix: BASE_TIME + 7200,
    nonce: "agreement-nonce-01",
    expiresAtUnix: BASE_TIME + 600,
  }
  const signA = (a: Agreement) => signEnvelope("pactlane.negotiation.v1", a.buyerAgentId, atlas.comm, a)
  const opts = { providerWallet: scout.address, acceptedQuote: quote }

  test("accepts an agreement bound to the quote", async () => {
    const res = await validateAgreement(signA(agreement), atlas.comm.publicKeyHex, ctx, opts)
    expect(res.agreement.budgetAtomic).toBe("4000000")
  })

  test("rejects evaluator equal to provider", async () => {
    await expect(validateAgreement(signA({ ...agreement, evaluatorAddress: scout.address }), atlas.comm.publicKeyHex, ctx, opts)).rejects.toThrow(/evaluator/)
  })

  test("rejects silent budget change", async () => {
    await expect(validateAgreement(signA({ ...agreement, budgetAtomic: "4000001" }), atlas.comm.publicKeyHex, ctx, opts)).rejects.toThrow(/budget/)
  })
})
