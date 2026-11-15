import { describe, expect, test } from "bun:test"
import example from "../fixtures/testnet.example.json"
import {
  deploymentManifestSchema,
  ManifestError,
  parseManifest,
} from "./manifest"

const clone = () => structuredClone(example) as Record<string, any>
const MAINNET = "Public Global Stellar Network ; September 2015"

function issues(input: unknown, opts = {}) {
  try {
    parseManifest(input, opts)
    return []
  } catch (e) {
    expect(e).toBeInstanceOf(ManifestError)
    return (e as ManifestError).issues
  }
}

describe("deploymentManifestSchema", () => {
  test("parses the real pactlane-protocol testnet manifest", () => {
    const m = parseManifest(example)
    expect(m.network).toBe("testnet")
    expect(m.contracts["pactlane-commerce"].contractId).toBe(
      "CB3DJM7B7THZYCYINV22NATMRV3AFG4XX7235KYP2VVGOTRG2CGVKIQS"
    )
    expect(m.contracts["pactlane-commerce"].wasmSha256).toMatch(
      /^[0-9a-f]{64}$/
    )
  })

  test("rejects mainnet unless reviewed", () => {
    const m = clone()
    m.network = "mainnet"
    m.networkPassphrase = MAINNET
    expect(issues(m)[0]).toContain("mainnet manifests are refused")
    expect(parseManifest(m, { reviewed: true }).network).toBe("mainnet")
  })

  test.each([
    [
      "bad contract id",
      (m: any) =>
        (m.contracts["pactlane-commerce"].contractId =
          "CB3DJM7B7THZYCYINV22NATMRV3AFG4XX7235KYP2VVGOTRG2CGVKIQA"),
      "contractId",
    ],
    [
      "account id as contract",
      (m: any) =>
        (m.contracts["pactlane-commerce"].constructorArgs.token =
          m.contracts["pactlane-commerce"].constructorArgs.admin),
      "token",
    ],
    [
      "short wasm hash",
      (m: any) => (m.contracts["pactlane-commerce"].wasmSha256 = "abc"),
      "wasmSha256",
    ],
    [
      "uppercase wasm hash",
      (m: any) =>
        (m.contracts["pactlane-commerce"].wasmSha256 = "A".repeat(64)),
      "wasmSha256",
    ],
    [
      "wrong passphrase",
      (m: any) => (m.networkPassphrase = MAINNET),
      "networkPassphrase",
    ],
    [
      "policy bound to another kernel",
      (m: any) =>
        (m.contracts["pactlane-evaluation-policy"].constructorArgs.kernel =
          m.contracts["pactlane-commerce"].constructorArgs.token),
      "kernel",
    ],
    ["unknown field", (m: any) => (m.extra = true), "(root)"],
    [
      "missing kernel",
      (m: any) => delete m.contracts["pactlane-commerce"],
      "pactlane-commerce",
    ],
  ])("rejects %s", (_label, mutate, path) => {
    const m = clone()
    mutate(m)
    const found = issues(m)
    expect(found.length).toBeGreaterThan(0)
    expect(found.join("\n")).toContain(path)
  })

  test("the policy contract is optional", () => {
    const m = clone()
    delete m.contracts["pactlane-evaluation-policy"]
    expect(deploymentManifestSchema.safeParse(m).success).toBe(true)
  })
})
