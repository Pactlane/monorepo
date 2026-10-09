import { formatUsdc } from "@pactlane/core/money"
import {
  explorerTxUrl,
  explorerContractUrl,
  type NetworkId,
} from "@pactlane/core/network"

export { formatUsdc, explorerTxUrl, explorerContractUrl, type NetworkId }

export function agentIndex(agentId: string) {
  return `#${agentId.split("#")[1] ?? "?"}`
}

export function shortAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

export function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  })
}

export const agentHref = (agentId: string) =>
  `/agents/${encodeURIComponent(agentId)}`
