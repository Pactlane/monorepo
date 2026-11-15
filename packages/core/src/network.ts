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
  if (!found)
    throw new Error(`Unknown Stellar network passphrase: ${passphrase}`)
  return found
}

function explorerUrl(network: NetworkId, kind: string, id: string): string {
  const value = id.trim()
  if (!value) throw new Error(`Explorer ${kind} id must not be empty`)
  return `${NETWORKS[network].explorerUrl}/${kind}/${encodeURIComponent(value)}`
}

export function explorerTxUrl(network: NetworkId, txHash: string): string {
  return explorerUrl(network, "tx", txHash)
}

export function explorerContractUrl(
  network: NetworkId,
  contractId: string
): string {
  return explorerUrl(network, "contract", contractId)
}

export function explorerAccountUrl(
  network: NetworkId,
  account: string
): string {
  return explorerUrl(network, "account", account)
}

export function explorerLedgerUrl(
  network: NetworkId,
  sequence: number | bigint
): string {
  const valid =
    typeof sequence === "bigint"
      ? sequence > 0n
      : Number.isSafeInteger(sequence) && sequence > 0
  if (!valid) throw new Error(`Invalid ledger sequence: ${sequence}`)
  return explorerUrl(network, "ledger", String(sequence))
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
