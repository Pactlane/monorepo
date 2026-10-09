import { describe, expect, test } from "bun:test"
import { agentProfileSchema, jobSchema, taskSpecSchema } from "@pactlane/core"
import { agents, fixtureIdentity, jobs, marketReportTask } from "./index"

describe("fixtures", () => {
  test("are schema-valid", () => {
    for (const a of agents) agentProfileSchema.parse(a)
    for (const j of jobs) jobSchema.parse(j)
    taskSpecSchema.parse(marketReportTask)
  })

  test("are deterministic", () => {
    expect(fixtureIdentity("scout").address).toBe(fixtureIdentity("scout").address)
    expect(fixtureIdentity("scout").comm.publicKeyHex).toBe(fixtureIdentity("scout").comm.publicKeyHex)
  })

  test("evaluator is never the provider", () => {
    for (const j of jobs) {
      const provider = agents.find((a) => a.agentId === j.providerAgentId)!
      expect(provider.providerWallet).not.toBe(j.evaluatorAddress)
    }
  })
})
