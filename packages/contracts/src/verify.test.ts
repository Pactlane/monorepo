import { describe, expect, test } from "bun:test"
import { loadEnv } from "@pactlane/config"
import example from "../fixtures/testnet.example.json"
import { parseManifest } from "./manifest"
import { STELLAR_8004_REGISTRIES } from "./registries"
import { assertEnvMatchesManifest, EnvManifestMismatchError } from "./verify"

const manifest = parseManifest(example)
const USDC = manifest.contracts["pactlane-commerce"].constructorArgs.token
const reg = STELLAR_8004_REGISTRIES.testnet

describe("assertEnvMatchesManifest", () => {
  test("passes when every configured id matches", () => {
    const env = loadEnv({
      USDC_ASSET_CONTRACT_ID: USDC,
      STELLAR_8004_IDENTITY_REGISTRY_ID: reg.identity,
      STELLAR_8004_REPUTATION_REGISTRY_ID: reg.reputation,
    })
    expect(() => assertEnvMatchesManifest(env, manifest)).not.toThrow()
  })

  test("unset optional ids are not mismatches", () => {
    expect(() => assertEnvMatchesManifest(loadEnv({}), manifest)).not.toThrow()
  })

  test("lists every mismatched field in one error", () => {
    const env = {
      ...loadEnv({}),
      STELLAR_NETWORK: "mainnet" as const,
      STELLAR_NETWORK_PASSPHRASE:
        "Public Global Stellar Network ; September 2015",
      USDC_ASSET_CONTRACT_ID: reg.identity,
      STELLAR_8004_IDENTITY_REGISTRY_ID: reg.reputation,
      STELLAR_8004_REPUTATION_REGISTRY_ID: reg.identity,
    }
    const error = (() => {
      try {
        assertEnvMatchesManifest(env, manifest)
      } catch (e) {
        return e
      }
    })()
    expect(error).toBeInstanceOf(EnvManifestMismatchError)
    const fields = (error as EnvManifestMismatchError).mismatches.map(
      (m) => m.split(":")[0]
    )
    expect(fields).toEqual([
      "STELLAR_NETWORK",
      "STELLAR_NETWORK_PASSPHRASE",
      "USDC_ASSET_CONTRACT_ID",
      "STELLAR_8004_IDENTITY_REGISTRY_ID",
      "STELLAR_8004_REPUTATION_REGISTRY_ID",
    ])
    expect((error as Error).message).toContain(`manifest expects ${USDC}`)
  })
})
