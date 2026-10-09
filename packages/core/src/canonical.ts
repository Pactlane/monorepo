import { createHash } from "node:crypto"

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export function canonicalize(value: unknown): string {
  if (value === null) return "null"
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false"
    case "number":
      if (!Number.isFinite(value)) throw new Error("Non-finite numbers cannot be canonicalized")
      return JSON.stringify(value)
    case "string":
      return JSON.stringify(value)
    case "bigint":
      throw new Error("Encode bigint values as decimal strings before hashing")
    case "object": {
      if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`
    }
    default:
      throw new Error(`Cannot canonicalize ${typeof value}`)
  }
}

export type Sha256Ref = `sha256:${string}`

export function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex")
}

export function sha256Ref(data: Uint8Array | string): Sha256Ref {
  return `sha256:${sha256Hex(data)}`
}

export const DOMAINS = {
  taskSpec: "pactlane.task.v1",
  quote: "pactlane.quote.v1",
  agreement: "pactlane.negotiation.v1",
  deliverable: "pactlane.deliverable.v1",
  evaluation: "pactlane.evaluation.v1",
  agent: "pactlane.agent.v1",
} as const

export type Domain = (typeof DOMAINS)[keyof typeof DOMAINS]

export function commitmentPreimage(domain: Domain, value: unknown): string {
  return `${domain}\n${canonicalize(value)}`
}

export function commit(domain: Domain, value: unknown): Sha256Ref {
  return sha256Ref(commitmentPreimage(domain, value))
}

export function isSha256Ref(value: string): value is Sha256Ref {
  return /^sha256:[0-9a-f]{64}$/.test(value)
}
