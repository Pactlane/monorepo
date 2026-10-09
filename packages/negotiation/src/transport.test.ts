import { expect, test } from "bun:test"
import { fixtureIdentity } from "@pactlane/test-utils"
import { signEnvelope, verifyEnvelope, type SignedEnvelope } from "./envelope"
import { LocalHub } from "./transport"

test("local transport delivers isolated copies between peers", async () => {
  const hub = new LocalHub()
  const buyer = hub.connect("atlas")
  const provider = hub.connect("scout")
  const inbox: SignedEnvelope[] = []
  await provider.receive(async (m) => void inbox.push(m))

  const env = signEnvelope("pactlane.quote.v1", "atlas", fixtureIdentity("atlas").comm, { ask: "quote" })
  await buyer.send("scout", env)

  expect(inbox).toHaveLength(1)
  expect(inbox[0]).not.toBe(env)
  expect(verifyEnvelope(inbox[0]!).ok).toBe(true)
  await expect(buyer.send("nobody", env)).rejects.toThrow(/Unknown peer/)
})
