type Profile = { agentId: string; capabilities: string[] }

export function similarAgents<T extends { profile: Profile }>(
  current: Profile,
  agents: T[]
): T[] {
  const capabilities = new Set(current.capabilities)
  return agents
    .filter(
      ({ profile }) =>
        profile.agentId !== current.agentId &&
        profile.capabilities.some((capability) => capabilities.has(capability))
    )
    .slice(0, 3)
}
