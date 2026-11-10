import { scValToNative, xdr, type rpc } from "@stellar/stellar-sdk"

export const SAC_EVENT_NAMES = [
  "transfer",
  "mint",
  "burn",
  "clawback",
  "approve",
  "set_admin",
  "set_authorized",
  "fee",
] as const

export type RawContractEvent = rpc.Api.RawEventResponse | rpc.Api.EventResponse

export interface DecodedEvent {
  id: string
  contractId: string
  ledger: number
  txHash: string
  eventIndex: number
  name: string
  topics: unknown[]
  data: unknown
}

const EVENT_ID = /^\d+-(\d+)$/

function toScVal(value: string | xdr.ScVal): xdr.ScVal {
  return typeof value === "string" ? xdr.ScVal.fromXDR(value, "base64") : value
}

export function decodeEvent(
  raw: RawContractEvent,
  knownNames: Iterable<string> = SAC_EVENT_NAMES
): DecodedEvent | null {
  const index = EVENT_ID.exec(raw.id)
  const contractId =
    typeof raw.contractId === "string"
      ? raw.contractId
      : raw.contractId?.contractId()
  const topic = raw.topic ?? []
  if (!index || !contractId || topic.length === 0) return null

  try {
    const [first, ...rest] = topic.map((t) => toScVal(t))
    if (first?.type !== "scvSymbol") return null
    const name = String(scValToNative(first))
    if (!new Set(knownNames).has(name)) return null
    return {
      id: raw.id,
      contractId,
      ledger: raw.ledger,
      txHash: raw.txHash,
      eventIndex: Number(index[1]),
      name,
      topics: rest.map((t) => scValToNative(t)),
      data: scValToNative(toScVal(raw.value)),
    }
  } catch {
    return null
  }
}
