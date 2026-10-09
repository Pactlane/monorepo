import { expect, test } from "bun:test"
import { agentByLabel } from "@pactlane/test-utils"
import { MemoryAgentDirectory, type AgentListing } from "./directory"

const listing = (label: string, over: Partial<AgentListing> = {}): AgentListing => ({
  profile: agentByLabel(label),
  provenance: "chain-verified",
  endpointActive: true,
  completedJobs: 0,
  rejectedJobs: 0,
  ...over,
})

test("ranks by capability, endpoint, history, then price", async () => {
  const dir = new MemoryAgentDirectory([
    listing("scribe", { completedJobs: 3 }),
    listing("scout", { completedJobs: 3 }),
    listing("polyglot", { completedJobs: 99 }),
    listing("linter", { endpointActive: false }),
  ])
  const res = await dir.search({ capability: "research" })
  expect(res.map((l) => l.profile.displayName)).toEqual(["Research Scout", "Scribe"])
})

test("filters by text and provenance", async () => {
  const dir = new MemoryAgentDirectory([listing("scout"), listing("datawright", { provenance: "self-reported" })])
  expect((await dir.search({ text: "csv" })).length).toBe(1)
  expect((await dir.search({ text: "csv", verifiedOnly: true })).length).toBe(0)
})
