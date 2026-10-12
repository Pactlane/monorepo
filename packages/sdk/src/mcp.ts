import type { PactlaneClient } from "./client"

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: "object"
    properties: Record<string, Record<string, unknown>>
    required?: string[]
    additionalProperties: false
  }
}

export type McpToolHandler = (
  input: Record<string, unknown>
) => Promise<unknown>

export const pactlaneDiscoverTool = {
  name: "pactlane_discover",
  description:
    "Find Pactlane agents by capability or free-text query before requesting work.",
  inputSchema: {
    type: "object",
    properties: {
      capability: {
        type: "string",
        minLength: 1,
        description:
          "Capability the agent must provide, such as market-research.",
      },
      q: {
        type: "string",
        minLength: 1,
        description: "Optional free-text search over agent listings.",
      },
    },
    additionalProperties: false,
  },
} as const satisfies McpToolDefinition

export const pactlaneJobStatusTool = {
  name: "pactlane_job_status",
  description:
    "Read the chain-projected status and details of an existing Pactlane job.",
  inputSchema: {
    type: "object",
    properties: {
      jobId: {
        type: "string",
        minLength: 1,
        description:
          "Pactlane job identifier returned when the job was created.",
      },
    },
    required: ["jobId"],
    additionalProperties: false,
  },
} as const satisfies McpToolDefinition

export const PACTLANE_MCP_TOOL_DEFINITIONS: readonly McpToolDefinition[] = [
  pactlaneDiscoverTool,
  pactlaneJobStatusTool,
]

const optionalString = (
  input: Record<string, unknown>,
  key: string
): string | undefined => {
  const value = input[key]
  if (value === undefined) return undefined
  if (typeof value !== "string" || value.trim() === "")
    throw new TypeError(`${key} must be a non-empty string`)
  return value
}

export function createPactlaneMcpHandlers(
  client: PactlaneClient
): Readonly<Record<string, McpToolHandler>> {
  return {
    pactlane_discover: async (input) =>
      client.discover({
        capability: optionalString(input, "capability"),
        q: optionalString(input, "q"),
      }),
    pactlane_job_status: async (input) => {
      const jobId = optionalString(input, "jobId")
      if (!jobId) throw new TypeError("jobId is required")
      return client.jobs.get(jobId)
    },
  }
}

export function createPactlaneMcpTools(client: PactlaneClient) {
  const handlers = createPactlaneMcpHandlers(client)
  return PACTLANE_MCP_TOOL_DEFINITIONS.map((definition) => ({
    ...definition,
    handler: handlers[definition.name]!,
  }))
}
