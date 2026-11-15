import compat from "../compat.json"

export type CompatContract = "pactlane-commerce" | "pactlane-evaluation-policy"

export interface CompatEntry {
  sdk: string
  contracts: Partial<Record<CompatContract, string[]>>
}

export interface CompatMatrix {
  entries: CompatEntry[]
  unsupported?: Record<string, string>
}

export type CompatResult =
  { supported: true } | { supported: false; reason: string }

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/
const PATTERN = /^(\d+)\.(\d+|x)\.(\d+|x)$/

export function matchesVersion(version: string, pattern: string): boolean {
  const v = VERSION.exec(version.trim())
  const p = PATTERN.exec(pattern.trim())
  if (!v || !p)
    throw new Error(`Bad version "${version}" or pattern "${pattern}"`)
  return [1, 2, 3].every((i) => p[i] === "x" || p[i] === v[i])
}

export function checkCompatibility(
  sdkVersion: string,
  wasmHash: string,
  contract: CompatContract = "pactlane-commerce",
  matrix: CompatMatrix = compat as CompatMatrix
): CompatResult {
  const hash = wasmHash.toLowerCase()
  const known = matrix.unsupported?.[hash]
  if (known)
    return {
      supported: false,
      reason: `wasm ${hash.slice(0, 12)} is unsupported: ${known}`,
    }
  const entries = matrix.entries.filter((e) =>
    matchesVersion(sdkVersion, e.sdk)
  )
  if (!entries.length)
    return {
      supported: false,
      reason: `SDK ${sdkVersion} is not in the compatibility matrix`,
    }
  if (entries.some((e) => e.contracts[contract]?.includes(hash)))
    return { supported: true }
  return {
    supported: false,
    reason: `wasm ${hash.slice(0, 12)} is not listed for ${contract} with SDK ${sdkVersion}`,
  }
}

export function isSupported(
  sdkVersion: string,
  wasmHash: string,
  contract?: CompatContract
): boolean {
  return checkCompatibility(sdkVersion, wasmHash, contract).supported
}
