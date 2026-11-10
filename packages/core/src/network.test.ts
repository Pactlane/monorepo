import { describe, expect, test } from "bun:test"
import {
  explorerAccountUrl,
  explorerContractUrl,
  explorerLedgerUrl,
  explorerTxUrl,
} from "./network"

const TX = "53abaa15581a49749cb723387adfc6a7332206a9c2cf0d5e6b402a9173f91fdf"
const CONTRACT = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
const ACCOUNT = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

const BASES = {
  testnet: "https://stellar.expert/explorer/testnet",
  mainnet: "https://stellar.expert/explorer/public",
} as const

describe.each(["testnet", "mainnet"] as const)("explorer links on %s", (n) => {
  test("transaction", () => {
    expect(explorerTxUrl(n, TX)).toBe(`${BASES[n]}/tx/${TX}`)
  })
  test("contract", () => {
    expect(explorerContractUrl(n, CONTRACT)).toBe(
      `${BASES[n]}/contract/${CONTRACT}`
    )
  })
  test("account", () => {
    expect(explorerAccountUrl(n, ACCOUNT)).toBe(
      `${BASES[n]}/account/${ACCOUNT}`
    )
  })
  test("ledger", () => {
    expect(explorerLedgerUrl(n, 5664948)).toBe(`${BASES[n]}/ledger/5664948`)
    expect(explorerLedgerUrl(n, 5664948n)).toBe(`${BASES[n]}/ledger/5664948`)
  })
})

describe("explorer link guards", () => {
  test.each(["", "   ", "\t\n"])("rejects empty id %p", (id) => {
    expect(() => explorerTxUrl("testnet", id)).toThrow(/must not be empty/)
    expect(() => explorerContractUrl("testnet", id)).toThrow(
      /must not be empty/
    )
    expect(() => explorerAccountUrl("mainnet", id)).toThrow(/must not be empty/)
  })

  test.each([0, -1, 1.5, Number.NaN, 0n, -5n])("rejects ledger %p", (seq) => {
    expect(() => explorerLedgerUrl("testnet", seq)).toThrow(/Invalid ledger/)
  })

  test("trims and encodes ids", () => {
    expect(explorerTxUrl("testnet", `  ${TX} `)).toBe(
      `${BASES.testnet}/tx/${TX}`
    )
    expect(explorerTxUrl("testnet", "a/b")).toBe(`${BASES.testnet}/tx/a%2Fb`)
  })
})
