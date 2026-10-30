import { expect, test } from "bun:test"
import { similarAgents } from "../app/lib/similar-agents"

test("excludes the current agent and agents with unrelated capabilities, capped at three", () => {
  const current = { agentId: "self", capabilities: ["research"] }
  const matching = [1, 2, 3, 4].map((id) => ({
    profile: { agentId: String(id), capabilities: ["research", "summary"] },
  }))
  expect(
    similarAgents(current, [
      { profile: current },
      { profile: { agentId: "other", capabilities: ["code"] } },
      ...matching,
    ])
  ).toEqual(matching.slice(0, 3))
  expect(similarAgents({ ...current, capabilities: [] }, matching)).toEqual([])
})
