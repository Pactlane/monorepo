export interface Asset {
  code: string
  contractId: string
  decimals: number
  network: "testnet" | "mainnet"
}

export const USDC_DECIMALS = 7

const DECIMAL = /^(\d+)(?:\.(\d+))?$/

export function toAtomic(amount: string, decimals = USDC_DECIMALS): bigint {
  const m = DECIMAL.exec(amount.trim())
  if (!m) throw new Error(`Invalid decimal amount: ${amount}`)
  const whole = m[1]!
  const frac = m[2] ?? ""
  if (frac.length > decimals) {
    throw new Error(`Amount ${amount} exceeds ${decimals} decimal places`)
  }
  return BigInt(whole + frac.padEnd(decimals, "0"))
}

export function fromAtomic(atomic: bigint | string, decimals = USDC_DECIMALS): string {
  const value = typeof atomic === "string" ? BigInt(atomic) : atomic
  if (value < 0n) throw new Error("Negative amounts are not supported")
  const s = value.toString().padStart(decimals + 1, "0")
  const whole = s.slice(0, -decimals) || "0"
  const frac = s.slice(-decimals).replace(/0+$/, "")
  return frac ? `${whole}.${frac}` : whole
}

export function formatUsdc(atomic: bigint | string, minFraction = 2): string {
  const [whole, frac = ""] = fromAtomic(atomic).split(".")
  return `${whole}.${frac.padEnd(minFraction, "0")} USDC`
}

export function assertSameAsset(expected: Asset, actual: Pick<Asset, "contractId" | "network">) {
  if (expected.network !== actual.network) {
    throw new Error(`Asset network mismatch: ${expected.network} vs ${actual.network}`)
  }
  if (expected.contractId !== actual.contractId) {
    throw new Error(`Asset contract mismatch: expected ${expected.contractId}`)
  }
}
