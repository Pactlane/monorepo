import { describe, expect, test } from "bun:test"
import { Keypair, scValToNative } from "@stellar/stellar-sdk"
import { sha256Ref } from "@pactlane/core"
import { addressToScVal, amountToScVal, hashToScVal } from "./scval"

const CONTRACT = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

describe("hashToScVal", () => {
  test("encodes a sha256 ref as 32 bytes and round-trips", () => {
    const ref = sha256Ref(new TextEncoder().encode("pactlane"))
    const value = hashToScVal(ref)
    expect(value.type).toBe("scvBytes")
    const native = scValToNative(value) as Uint8Array
    expect(native.length).toBe(32)
    expect(`sha256:${hex(native)}`).toBe(ref)
  })

  test.each([
    "sha256:abc",
    `sha256:${"A".repeat(64)}`,
    `sha512:${"a".repeat(64)}`,
    "a".repeat(64),
  ])("rejects %p", (ref) => {
    expect(() => hashToScVal(ref)).toThrow(/Invalid sha256 reference/)
  })
})

describe("amountToScVal", () => {
  test.each([0n, 4_000_000n, (1n << 127n) - 1n])(
    "round-trips %p as i128",
    (v) => {
      const value = amountToScVal(v)
      expect(value.type).toBe("scvI128")
      expect(scValToNative(value)).toBe(v)
    }
  )

  test("rejects negatives, overflow and non-bigint", () => {
    expect(() => amountToScVal(-1n)).toThrow(RangeError)
    expect(() => amountToScVal(1n << 127n)).toThrow(RangeError)
    expect(() => amountToScVal(5 as unknown as bigint)).toThrow(TypeError)
  })
})

describe("addressToScVal", () => {
  test.each([Keypair.random().publicKey(), CONTRACT])("round-trips %p", (a) => {
    const value = addressToScVal(a)
    expect(value.type).toBe("scvAddress")
    expect(scValToNative(value)).toBe(a)
  })

  test.each(["", "GABC", CONTRACT.toLowerCase(), Keypair.random().secret()])(
    "rejects %p",
    (a) => {
      expect(() => addressToScVal(a)).toThrow(/Expected a G/)
    }
  )
})
