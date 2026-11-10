import { describe, expect, test } from "bun:test"
import { Keypair, nativeToScVal, rpc, xdr } from "@stellar/stellar-sdk"
import { PACTLANE_TESTNET } from "./kernel"
import { readTokenBalance } from "./balance"

const owner = Keypair.random().publicKey()

function fakeRpc(result: xdr.ScVal | string) {
  return {
    async simulateTransaction() {
      if (typeof result === "string") {
        return {
          id: "1",
          latestLedger: 1,
          _parsed: true,
          events: [],
          error: result,
        }
      }
      return {
        id: "1",
        latestLedger: 1,
        _parsed: true,
        events: [],
        minResourceFee: "0",
        transactionData: undefined as never,
        result: { auth: [], retval: result },
      } as rpc.Api.SimulateTransactionSuccessResponse
    },
  }
}

describe("readTokenBalance", () => {
  test("returns the i128 balance as bigint", async () => {
    const big = 2n ** 100n
    const value = await readTokenBalance(
      fakeRpc(nativeToScVal(big, { type: "i128" })),
      PACTLANE_TESTNET.token,
      owner
    )
    expect(value).toBe(big)
    expect(typeof value).toBe("bigint")
  })

  test("returns 0n when the account has no trustline or balance entry", async () => {
    expect(
      await readTokenBalance(
        fakeRpc("HostError: Error(Contract, #13)"),
        PACTLANE_TESTNET.token,
        owner
      )
    ).toBe(0n)
  })

  test("rethrows other failures", async () => {
    await expect(
      readTokenBalance(
        fakeRpc("HostError: Error(Contract, #2)"),
        PACTLANE_TESTNET.token,
        owner
      )
    ).rejects.toThrow("#2")
    await expect(
      readTokenBalance(
        fakeRpc(xdr.ScVal.scvU32(5)),
        PACTLANE_TESTNET.token,
        owner
      )
    ).rejects.toThrow("Unexpected balance type")
  })
})
