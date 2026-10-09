import { describe, expect, test } from "bun:test"
import { loadEnv } from "./env"

describe("loadEnv", () => {
  test("defaults to testnet simulation", () => {
    const env = loadEnv({})
    expect(env.STELLAR_NETWORK).toBe("testnet")
    expect(env.MOCK_EXTERNALS).toBe(true)
    expect(env.STELLAR_NETWORK_PASSPHRASE).toBe(
      "Test SDF Network ; September 2015"
    )
  })

  test("rejects passphrase that does not match the network", () => {
    expect(() =>
      loadEnv({
        STELLAR_NETWORK: "testnet",
        STELLAR_NETWORK_PASSPHRASE:
          "Public Global Stellar Network ; September 2015",
      })
    ).toThrow(/does not match/)
  })

  test("refuses simulation mode on mainnet", () => {
    expect(() => loadEnv({ STELLAR_NETWORK: "mainnet" })).toThrow(/Simulation/)
  })
})
