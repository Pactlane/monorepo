import { describe, expect, test } from "bun:test"
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk"
import { JOB_STATUSES } from "@pactlane/core/job"
import { toKernelJob } from "@pactlane/stellar"
import { fromChainStatus, toChainStatus } from "./status"

describe("fromChainStatus", () => {
  test.each([
    [0, "open"],
    [1, "funded"],
    [2, "submitted"],
    [3, "completed"],
    [4, "rejected"],
    [5, "expired"],
  ] as const)("JobState %i is %s", (value, status) => {
    expect(fromChainStatus(value)).toBe(status)
    expect(fromChainStatus(BigInt(value))).toBe(status)
    expect(fromChainStatus(String(value))).toBe(status)
    expect(toChainStatus(status)).toBe(value)
  })

  test("is exhaustive over JobStatus", () => {
    expect(JOB_STATUSES.map(toChainStatus).map(fromChainStatus)).toEqual([
      ...JOB_STATUSES,
    ])
  })

  test.each([6, -1, 1.5, "x", null, undefined, {}])("throws on %p", (value) => {
    expect(() => fromChainStatus(value)).toThrow(RangeError)
  })

  test("agrees with @pactlane/stellar's decoding of a real Job value", () => {
    const c = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHK3M"
    const e = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAK3IM"
    for (let s = 0; s < 6; s++) {
      const fields: Record<string, xdr.ScVal> = {
        budget: nativeToScVal(0n, { type: "i128" }),
        client: Address.fromString(c).toScVal(),
        evaluator: Address.fromString(e).toScVal(),
        expires_at: nativeToScVal(1n, { type: "u64" }),
        id: nativeToScVal(1n, { type: "u64" }),
        provider: xdr.ScVal.scvVoid(),
        reason: xdr.ScVal.scvVoid(),
        spec_hash: xdr.ScVal.scvBytes(new Uint8Array(32)),
        state: xdr.ScVal.scvU32(s),
        work_hash: xdr.ScVal.scvVoid(),
      }
      const value = xdr.ScVal.scvMap(
        Object.keys(fields)
          .sort()
          .map(
            (k) =>
              new xdr.ScMapEntry({
                key: xdr.ScVal.scvSymbol(k),
                val: fields[k]!,
              })
          )
      )
      expect(toKernelJob(value).status).toBe(fromChainStatus(s))
    }
  })
})
