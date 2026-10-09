import type { Job, JobStatus } from "@pactlane/core"
import { MemoryAgentDirectory, type AgentDirectory, type AgentListing } from "@pactlane/discovery"
import { agents, jobs as fixtureJobs } from "@pactlane/test-utils"

export interface JobQuery {
  status?: JobStatus
  agentId?: string
  limit?: number
}

export interface Repository {
  directory: AgentDirectory
  listJobs(q: JobQuery): Promise<Job[]>
  getJob(id: string): Promise<Job | undefined>
}

export function createSimulationRepository(): Repository {
  const jobs = [...fixtureJobs].reverse()
  const count = (agentId: string, status: JobStatus) =>
    jobs.filter((j) => j.providerAgentId === agentId && j.status === status).length

  const listings: AgentListing[] = agents.map((profile) => ({
    profile,
    provenance: "chain-verified",
    endpointActive: profile.displayName !== "Scribe",
    completedJobs: count(profile.agentId, "completed"),
    rejectedJobs: count(profile.agentId, "rejected"),
  }))

  return {
    directory: new MemoryAgentDirectory(listings),
    async listJobs({ status, agentId, limit = 50 }) {
      return jobs
        .filter((j) => (!status || j.status === status) && (!agentId || j.providerAgentId === agentId || j.buyerAgentId === agentId))
        .slice(0, limit)
    },
    async getJob(id) {
      return jobs.find((j) => j.id === id)
    },
  }
}
