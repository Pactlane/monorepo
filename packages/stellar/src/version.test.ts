import { describe, expect, test } from "bun:test"
import { Keypair, Networks, StrKey } from "@stellar/stellar-sdk"
import { STELLAR_NETWORKS } from "@pactlane/config"
import { STELLAR_SDK_VERSION } from "./index"
import sdkManifest from "../package.json"

describe("@stellar/stellar-sdk", () => {
  test("exposes the installed SDK version", () => {
    expect(STELLAR_SDK_VERSION).toMatch(/^\d+\.\d+\.\d+/)
    const [major, minor] = sdkManifest.dependencies["@stellar/stellar-sdk"]
      .replace(/^[~^]/, "")
      .split(".")
    expect(STELLAR_SDK_VERSION.startsWith(`${major}.${minor}.`)).toBe(true)
  })

  test("imports and agrees with configured network passphrases", () => {
    expect(StrKey.isValidEd25519PublicKey(Keypair.random().publicKey())).toBe(
      true
    )
    expect(Networks.TESTNET as string).toBe(STELLAR_NETWORKS.testnet.passphrase)
    expect(Networks.PUBLIC as string).toBe(STELLAR_NETWORKS.mainnet.passphrase)
  })
})
