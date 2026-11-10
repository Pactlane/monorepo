import { describe, expect, test } from "bun:test"
import {
  isAccountAddress,
  isContractAddress,
  isStellarAddress,
} from "./address"

const ACCOUNT = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
const CONTRACT = "CB3DJM7B7THZYCYINV22NATMRV3AFG4XX7235KYP2VVGOTRG2CGVKIQS"

function badChecksum(address: string) {
  const last = address.at(-1) === "A" ? "B" : "A"
  return address.slice(0, -1) + last
}

describe("address validation", () => {
  test("accepts real account and contract addresses", () => {
    expect(isAccountAddress(ACCOUNT)).toBe(true)
    expect(isContractAddress(CONTRACT)).toBe(true)
    expect(isStellarAddress(ACCOUNT)).toBe(true)
    expect(isStellarAddress(CONTRACT)).toBe(true)
  })

  test("does not confuse account and contract addresses", () => {
    expect(isAccountAddress(CONTRACT)).toBe(false)
    expect(isContractAddress(ACCOUNT)).toBe(false)
  })

  test("rejects bad checksums", () => {
    expect(isAccountAddress(badChecksum(ACCOUNT))).toBe(false)
    expect(isContractAddress(badChecksum(CONTRACT))).toBe(false)
  })

  test.each([
    "",
    "G",
    ACCOUNT.toLowerCase(),
    ACCOUNT.slice(1),
    `${ACCOUNT}A`,
    "SBK2VIYYSVG76E7VC3QHYARNFLY2EAQXDHRC7BMXBBGIFG74ARPRMNQM",
    null,
    42,
  ])("rejects %p", (value) => {
    expect(isStellarAddress(value)).toBe(false)
  })
})
