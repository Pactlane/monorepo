import { describe, expect, test } from "bun:test"
import example from "../fixtures/testnet.example.json"
import sdkPkg from "../../sdk/package.json"
import { checkCompatibility, isSupported, matchesVersion } from "./compat"

const KERNEL = example.contracts["pactlane-commerce"].wasmSha256
const POLICY = example.contracts["pactlane-evaluation-policy"].wasmSha256
const OLD_KERNEL =
  "fa5f3356d5e26db85bb34dbbc51a5eb00a1003572208c922f831388dd9eb339e"

describe("matchesVersion", () => {
  test.each([
    ["0.0.1", "0.0.x", true],
    ["0.1.7", "0.1.x", true],
    ["0.2.0", "0.1.x", false],
    ["1.4.2", "1.x.x", true],
    ["1.4.2", "1.4.2", true],
    ["1.4.3", "1.4.2", false],
  ])("%s against %s is %p", (v, p, ok) => {
    expect(matchesVersion(v, p)).toBe(ok)
  })
  test("rejects malformed input", () => {
    expect(() => matchesVersion("1.2", "1.x.x")).toThrow()
    expect(() => matchesVersion("1.2.3", "^1.2.3")).toThrow()
  })
})

describe("checkCompatibility", () => {
  test("the current SDK supports the deployed kernel and policy", () => {
    expect(isSupported(sdkPkg.version, KERNEL)).toBe(true)
    expect(
      isSupported(sdkPkg.version, POLICY, "pactlane-evaluation-policy")
    ).toBe(true)
  })

  test("unsupported combinations return false with a reason", () => {
    expect(checkCompatibility("0.0.1", OLD_KERNEL)).toEqual({
      supported: false,
      reason: expect.stringContaining("no get_jobs"),
    })
    expect(checkCompatibility("0.1.0", KERNEL).supported).toBe(false)
    expect(checkCompatibility("0.1.0", KERNEL)).toMatchObject({
      reason: expect.stringContaining("not in the compatibility matrix"),
    })
    expect(checkCompatibility("0.0.1", "0".repeat(64))).toMatchObject({
      reason: expect.stringContaining("not listed"),
    })
    expect(
      checkCompatibility("0.0.1", POLICY, "pactlane-commerce").supported
    ).toBe(false)
  })
})
