import { describe, expect, test } from "bun:test"
import { fixtureIdentity } from "@pactlane/test-utils"
import { signEnvelope, verifyEnvelope } from "./envelope"

const scout = fixtureIdentity("scout")
const scribe = fixtureIdentity("scribe")

describe("signed envelopes", () => {
  test("verify against the registered key", () => {
    const env = signEnvelope("pactlane.quote.v1", "scout", scout.comm, { price: "4000000" })
    expect(verifyEnvelope(env, scout.comm.publicKeyHex)).toEqual({ ok: true })
  })

  test("reject tampered payloads", () => {
    const env = signEnvelope("pactlane.quote.v1", "scout", scout.comm, { price: "4000000" })
    const tampered = { ...env, payload: { price: "1" } }
    expect(verifyEnvelope(tampered).ok).toBe(false)
  })

  test("reject signer substitution", () => {
    const env = signEnvelope("pactlane.quote.v1", "scout", scribe.comm, { price: "4000000" })
    expect(verifyEnvelope(env, scout.comm.publicKeyHex).ok).toBe(false)
  })

  test("reject cross-domain reuse", () => {
    const env = signEnvelope("pactlane.quote.v1", "scout", scout.comm, { price: "4000000" })
    expect(verifyEnvelope({ ...env, domain: "pactlane.negotiation.v1" }).ok).toBe(false)
  })
})
