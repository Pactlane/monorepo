import { describe, expect, test } from "bun:test"
import { SorobanDataBuilder, rpc } from "@stellar/stellar-sdk"
import { stroopsToXlm, summarizeFees } from "./fees"

const sim = (minResourceFee: string) =>
  ({
    id: "1",
    latestLedger: 1,
    _parsed: true,
    events: [],
    minResourceFee,
    transactionData: new SorobanDataBuilder(),
  }) as rpc.Api.SimulateTransactionSuccessResponse

describe("summarizeFees", () => {
  test("adds the inclusion fee to the simulated resource fee", () => {
    expect(summarizeFees(sim("1495781"))).toEqual({
      inclusionFee: 100n,
      resourceFee: 1_495_781n,
      totalStroops: 1_495_881n,
      totalXlm: "0.1495881",
    })
    expect(summarizeFees(sim("11717"), 1_000n).totalXlm).toBe("0.0012717")
  })

  test("refuses failed simulations and negative fees", () => {
    const failed = {
      id: "1",
      latestLedger: 1,
      _parsed: true,
      events: [],
      error: "boom",
    }
    expect(() => summarizeFees(failed)).toThrow("failed simulation")
    expect(() => summarizeFees(sim("1"), -1n)).toThrow(RangeError)
  })
})

describe("stroopsToXlm", () => {
  test.each([
    [0n, "0.0000000"],
    [1n, "0.0000001"],
    [10_000_000n, "1.0000000"],
    [100_000_000_000n, "10000.0000000"],
    [2n ** 63n - 1n, "922337203685.4775807"],
  ])("%p stroops is %p XLM", (stroops, xlm) => {
    expect(stroopsToXlm(stroops)).toBe(xlm)
  })

  test("uses no floating point", async () => {
    const source = await Bun.file(new URL("./fees.ts", import.meta.url)).text()
    expect(source).not.toMatch(/\bNumber\(|parseFloat|toFixed|\/ ?1e7|\* ?1e-7/)
  })
})
