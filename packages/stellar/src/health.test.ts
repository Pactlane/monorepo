import { describe, expect, test } from "bun:test"
import type { rpc } from "@stellar/stellar-sdk"
import { probeRpc } from "./health"

type Fake = Pick<rpc.Server, "getHealth" | "getLatestLedger">

function fake(
  over: Partial<Record<keyof Fake, () => Promise<unknown>>> = {}
): Fake {
  return {
    getHealth: (over.getHealth ??
      (async () => ({
        status: "healthy",
        latestLedger: 100,
      }))) as Fake["getHealth"],
    getLatestLedger: (over.getLatestLedger ??
      (async () => ({
        sequence: 5665298,
        closeTime: "1794350133",
      }))) as Fake["getLatestLedger"],
  }
}

describe("probeRpc", () => {
  test("reports a healthy RPC with its latest ledger and latency", async () => {
    let t = 1000
    const result = await probeRpc(fake(), { now: () => (t += 42) })
    expect(result).toEqual({ ok: true, latestLedger: 5665298, latencyMs: 42 })
  })

  test("returns ok:false on timeout instead of throwing", async () => {
    const hang = () => new Promise<never>(() => {})
    const result = await probeRpc(fake({ getHealth: hang }), { timeoutMs: 20 })
    expect(result.ok).toBe(false)
    expect(result.latestLedger).toBeNull()
    expect(result.error).toBe("RPC did not answer within 20ms")
  })

  test("returns ok:false when the RPC errors or is unhealthy", async () => {
    const down = await probeRpc(
      fake({
        getLatestLedger: async () => {
          throw new Error("fetch failed")
        },
      })
    )
    expect(down).toMatchObject({ ok: false, error: "fetch failed" })
    const sick = await probeRpc(
      fake({ getHealth: async () => ({ status: "unhealthy" }) })
    )
    expect(sick).toMatchObject({
      ok: false,
      latestLedger: 5665298,
      error: "RPC reports unhealthy",
    })
  })
})
