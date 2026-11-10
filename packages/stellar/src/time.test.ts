import { afterEach, describe, expect, setSystemTime, test } from "bun:test"
import type { rpc } from "@stellar/stellar-sdk"
import { isPastDeadline, ledgerNow } from "./time"

function fakeRpc(closeTimes: (string | Error)[]) {
  let calls = 0
  return {
    calls: () => calls,
    rpc: {
      async getLatestLedger() {
        const next = closeTimes[Math.min(calls++, closeTimes.length - 1)]!
        if (next instanceof Error) throw next
        return {
          sequence: 1,
          closeTime: next,
        } as rpc.Api.GetLatestLedgerResponse
      },
    },
  }
}

afterEach(() => setSystemTime())

describe("ledgerNow", () => {
  test("reads the latest ledger close time and caches it for 5s", async () => {
    setSystemTime(new Date("2026-11-10T00:00:00Z"))
    const fake = fakeRpc(["1794350133", "1794350140"])
    expect(await ledgerNow(fake.rpc)).toBe(1794350133)
    setSystemTime(new Date("2026-11-10T00:00:04.999Z"))
    expect(await ledgerNow(fake.rpc)).toBe(1794350133)
    expect(fake.calls()).toBe(1)
    setSystemTime(new Date("2026-11-10T00:00:05Z"))
    expect(await ledgerNow(fake.rpc)).toBe(1794350140)
    expect(fake.calls()).toBe(2)
  })

  test("does not cache failures", async () => {
    const fake = fakeRpc([new Error("down"), "1794350133"])
    await expect(ledgerNow(fake.rpc)).rejects.toThrow("down")
    expect(await ledgerNow(fake.rpc)).toBe(1794350133)
  })

  test("rejects malformed close times", async () => {
    await expect(ledgerNow(fakeRpc(["soon"]).rpc)).rejects.toThrow("Unexpected")
  })
})

describe("isPastDeadline", () => {
  test("uses ledger time, deadline inclusive like the kernel", async () => {
    const fake = fakeRpc(["1000"])
    expect(await isPastDeadline(fake.rpc, 999)).toBe(true)
    expect(await isPastDeadline(fake.rpc, 1000)).toBe(true)
    expect(await isPastDeadline(fake.rpc, 1001)).toBe(false)
  })
})
