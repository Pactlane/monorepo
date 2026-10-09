export type NetworkId = "testnet" | "mainnet"

export interface NetworkInfo {
  id: NetworkId
  passphrase: string
  caip2: string
  explorerUrl: string
}

export const NETWORKS: Record<NetworkId, NetworkInfo> = {
  testnet: {
    id: "testnet",
    passphrase: "Test SDF Network ; September 2015",
    caip2: "stellar:testnet",
    explorerUrl: "https://stellar.expert/explorer/testnet",
  },
  mainnet: {
    id: "mainnet",
    passphrase: "Public Global Stellar Network ; September 2015",
    caip2: "stellar:pubnet",
    explorerUrl: "https://stellar.expert/explorer/public",
  },
}

export function networkFromPassphrase(passphrase: string): NetworkInfo {
  const found = Object.values(NETWORKS).find((n) => n.passphrase === passphrase)
  if (!found) throw new Error(`Unknown Stellar network passphrase: ${passphrase}`)
  return found
}

export function explorerTxUrl(network: NetworkId, txHash: string): string {
  return `${NETWORKS[network].explorerUrl}/tx/${txHash}`
}

export function explorerContractUrl(network: NetworkId, contractId: string): string {
  return `${NETWORKS[network].explorerUrl}/contract/${contractId}`
}

const AGENT_ID = /^stellar:(testnet|mainnet):([A-Z0-9]+)#(\d+)$/

export interface ParsedAgentId {
  network: NetworkId
  registryId: string
  index: bigint
}

export function parseAgentId(agentId: string): ParsedAgentId {
  const m = AGENT_ID.exec(agentId)
  if (!m) throw new Error(`Invalid Pactlane agent id: ${agentId}`)
  return { network: m[1] as NetworkId, registryId: m[2]!, index: BigInt(m[3]!) }
}

export function formatAgentId(id: ParsedAgentId): string {
  return `stellar:${id.network}:${id.registryId}#${id.index}`
}
