import { describe, expect, test } from "bun:test"
import { Keypair } from "@stellar/stellar-sdk"
import { loadEnv, STELLAR_NETWORKS } from "@pactlane/config"
import { assertUsdcContract, sacContractId, USDC_ISSUERS } from "./asset"

const TESTNET = STELLAR_NETWORKS.testnet.passphrase
const MAINNET = STELLAR_NETWORKS.mainnet.passphrase

const TESTNET_USDC_SAC =
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
const MAINNET_USDC_SAC =
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75"

describe("sacContractId", () => {
  test("derives the native XLM SAC per network", () => {
    expect(sacContractId("XLM", undefined, TESTNET)).toBe(
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
    )
    expect(sacContractId("XLM", undefined, MAINNET)).toBe(
      "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"
    )
  })

  test("derives the known testnet USDC SAC", () => {
    expect(sacContractId("USDC", USDC_ISSUERS.testnet, TESTNET)).toBe(
      TESTNET_USDC_SAC
    )
    expect(sacContractId("USDC", USDC_ISSUERS.mainnet, MAINNET)).toBe(
      MAINNET_USDC_SAC
    )
  })

  test("same asset yields different ids on testnet and mainnet", () => {
    const issuer = Keypair.random().publicKey()
    expect(sacContractId("USDC", issuer, TESTNET)).not.toBe(
      sacContractId("USDC", issuer, MAINNET)
    )
  })

  test("rejects a non-native code without issuer", () => {
    expect(() => sacContractId("USDC", undefined, TESTNET)).toThrow()
  })
})

describe("assertUsdcContract", () => {
  test("returns the id when config matches the derived SAC", () => {
    const env = loadEnv({ USDC_ASSET_CONTRACT_ID: TESTNET_USDC_SAC })
    expect(assertUsdcContract(env)).toBe(TESTNET_USDC_SAC)
  })

  test("mismatch error names both ids", () => {
    const env = loadEnv({ USDC_ASSET_CONTRACT_ID: MAINNET_USDC_SAC })
    expect(() => assertUsdcContract(env)).toThrow(
      `USDC_ASSET_CONTRACT_ID mismatch: configured ${MAINNET_USDC_SAC}, derived ${TESTNET_USDC_SAC}`
    )
  })

  test("missing config names the expected id", () => {
    expect(() => assertUsdcContract(loadEnv({}))).toThrow(
      `USDC_ASSET_CONTRACT_ID is not set; expected ${TESTNET_USDC_SAC}`
    )
  })

  test("accepts a custom issuer", () => {
    const issuer = Keypair.random().publicKey()
    const id = sacContractId("USDC", issuer, TESTNET)
    const env = loadEnv({ USDC_ASSET_CONTRACT_ID: id })
    expect(assertUsdcContract(env, issuer)).toBe(id)
  })
})
