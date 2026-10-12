import { describe, expect, test } from "bun:test"
import { PactlaneClient } from "./client"
import { PACTLANE_MCP_TOOL_DEFINITIONS, createPactlaneMcpHandlers } from "./mcp"

describe("Pactlane MCP tools", () => {
  test("exports closed JSON schemas for discover and job status", () => {
    expect(PACTLANE_MCP_TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([
      "pactlane_discover",
      "pactlane_job_status",
    ])
    for (const tool of PACTLANE_MCP_TOOL_DEFINITIONS) {
      expect(tool.inputSchema.type).toBe("object")
      expect(tool.inputSchema.additionalProperties).toBe(false)
    }
    expect(PACTLANE_MCP_TOOL_DEFINITIONS[1]!.inputSchema.required).toEqual([
      "jobId",
    ])
  })

  test("handlers delegate discover and job status to PactlaneClient", async () => {
    const requests: string[] = []
    const client = new PactlaneClient({
      apiUrl: "https://api.pactlane.test",
      fetch: (async (request: Parameters<typeof fetch>[0]) => {
        const url = request.toString()
        requests.push(url)
        const data = url.includes("/agents?")
          ? [{ profile: { agentId: "agent-1" } }]
          : { id: "job/42", status: "funded" }
        return Response.json({ data })
      }) as unknown as typeof fetch,
    })
    const handlers = createPactlaneMcpHandlers(client)

    await expect(
      handlers.pactlane_discover!({ capability: "research", q: "climate" })
    ).resolves.toEqual([{ profile: { agentId: "agent-1" } }])
    await expect(
      handlers.pactlane_job_status!({ jobId: "job/42" })
    ).resolves.toEqual({ id: "job/42", status: "funded" })

    expect(requests).toEqual([
      "https://api.pactlane.test/v1/agents?capability=research&q=climate",
      "https://api.pactlane.test/v1/jobs/job%2F42",
    ])
  })

  test("handlers reject malformed input before calling the client", async () => {
    let called = false
    const client = new PactlaneClient({
      apiUrl: "https://api.pactlane.test",
      fetch: (async () => {
        called = true
        return Response.json({ data: {} })
      }) as unknown as typeof fetch,
    })
    const handlers = createPactlaneMcpHandlers(client)

    await expect(handlers.pactlane_job_status!({})).rejects.toThrow(
      "jobId is required"
    )
    await expect(
      handlers.pactlane_discover!({ capability: 42 })
    ).rejects.toThrow("capability must be a non-empty string")
    expect(called).toBe(false)
  })
})
