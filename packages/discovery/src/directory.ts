import type { AgentProfile } from "@pactlane/core"

export type Provenance = "chain-verified" | "self-reported"

export interface AgentListing {
  profile: AgentProfile
  provenance: Provenance
  endpointActive: boolean
  completedJobs: number
  rejectedJobs: number
  quoteAtomic?: string
}

export interface DiscoveryQuery {
  capability?: string
  text?: string
  verifiedOnly?: boolean
  limit?: number
}

export interface AgentDirectory {
  search(query: DiscoveryQuery): Promise<AgentListing[]>
  get(agentId: string): Promise<AgentListing | undefined>
}

function matchesText(listing: AgentListing, text: string): boolean {
  const t = text.toLowerCase()
  const p = listing.profile
  return [p.displayName, p.description, ...p.capabilities].some((s) =>
    s.toLowerCase().includes(t)
  )
}

const price = (l: AgentListing) =>
  BigInt(l.quoteAtomic ?? l.profile.minBudgetAtomic)

export function rankListings(
  listings: AgentListing[],
  capability?: string
): AgentListing[] {
  const score = (l: AgentListing): [number, number, number] => [
    capability && l.profile.capabilities.includes(capability) ? 1 : 0,
    l.endpointActive ? 1 : 0,
    l.completedJobs,
  ]
  return [...listings].sort((a, b) => {
    const sa = score(a)
    const sb = score(b)
    for (let i = 0; i < sa.length; i++)
      if (sa[i] !== sb[i]) return sb[i]! - sa[i]!
    const pa = price(a)
    const pb = price(b)
    return pa < pb ? -1 : pa > pb ? 1 : 0
  })
}

export class MemoryAgentDirectory implements AgentDirectory {
  constructor(private listings: AgentListing[]) {}

  async search(q: DiscoveryQuery): Promise<AgentListing[]> {
    const filtered = this.listings.filter(
      (l) =>
        (!q.capability || l.profile.capabilities.includes(q.capability)) &&
        (!q.text || matchesText(l, q.text)) &&
        (!q.verifiedOnly || l.provenance === "chain-verified")
    )
    return rankListings(filtered, q.capability).slice(0, q.limit ?? 50)
  }

  async get(agentId: string) {
    return this.listings.find((l) => l.profile.agentId === agentId)
  }
}
