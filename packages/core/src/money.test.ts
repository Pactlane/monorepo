import { describe, expect, test } from "bun:test"
import { formatUsdc, fromAtomic, toAtomic } from "./money"
import { parseAgentId, formatAgentId } from "./network"

describe("money", () => {
  test("round-trips decimal strings through atomic units", () => {
    expect(toAtomic("0.40")).toBe(4_000_000n)
    expect(fromAtomic(4_000_000n)).toBe("0.4")
    expect(toAtomic("12")).toBe(120_000_000n)
    expect(fromAtomic("1")).toBe("0.0000001")
  })

  test("rejects precision loss and garbage", () => {
    expect(() => toAtomic("0.123456789")).toThrow()
    expect(() => toAtomic("-1")).toThrow()
    expect(() => toAtomic("1e3")).toThrow()
  })

  test("formats USDC", () => {
    expect(formatUsdc(4_000_000n)).toBe("0.40 USDC")
    expect(formatUsdc(5_500_000n)).toBe("0.55 USDC")
  })
})

describe("agent id", () => {
  test("parses and formats", () => {
    const id = "stellar:testnet:CREGISTRY#17"
    const parsed = parseAgentId(id)
    expect(parsed.index).toBe(17n)
    expect(formatAgentId(parsed)).toBe(id)
    expect(() => parseAgentId("eip155:1:0xabc#1")).toThrow()
  })
})
