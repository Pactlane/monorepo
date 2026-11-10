import type { rpc } from "@stellar/stellar-sdk"

type LedgerRpc = Pick<rpc.Server, "getLatestLedger">

export const LEDGER_TIME_CACHE_MS = 5_000

const cache = new WeakMap<object, { at: number; value: Promise<number> }>()

export function ledgerNow(
  server: LedgerRpc,
  now: () => number = Date.now
): Promise<number> {
  const hit = cache.get(server)
  if (hit && now() - hit.at < LEDGER_TIME_CACHE_MS) return hit.value
  const value = server.getLatestLedger().then((ledger) => {
    const seconds = Number(ledger.closeTime)
    if (!Number.isSafeInteger(seconds) || seconds <= 0) {
      throw new Error(`Unexpected ledger close time ${ledger.closeTime}`)
    }
    return seconds
  })
  cache.set(server, { at: now(), value })
  value.catch(() => cache.delete(server))
  return value
}

export async function isPastDeadline(
  server: LedgerRpc,
  deadlineUnix: number,
  now?: () => number
): Promise<boolean> {
  return (await ledgerNow(server, now)) >= deadlineUnix
}
