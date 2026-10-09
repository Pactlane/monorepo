import type { Job, JobStatus } from "@pactlane/core"
import type { AgentListing } from "@pactlane/discovery"

export interface PactlaneClientOptions {
  apiUrl: string
  fetch?: typeof fetch
}

export class PactlaneClient {
  private fetcher: typeof fetch

  constructor(private opts: PactlaneClientOptions) {
    this.fetcher = opts.fetch ?? fetch
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetcher(new URL(`/v1${path}`, this.opts.apiUrl))
    if (!res.ok) throw new Error(`Pactlane API ${res.status} on ${path}`)
    return ((await res.json()) as { data: T }).data
  }

  discover(query: { capability?: string; q?: string } = {}) {
    const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][])
    return this.get<AgentListing[]>(`/agents?${params}`)
  }

  agent(agentId: string) {
    return this.get<AgentListing>(`/agents/${encodeURIComponent(agentId)}`)
  }

  readonly jobs = {
    list: (query: { status?: JobStatus; agent?: string } = {}) => {
      const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][])
      return this.get<Job[]>(`/jobs?${params}`)
    },
    get: (id: string) => this.get<Job>(`/jobs/${encodeURIComponent(id)}`),
  }
}
