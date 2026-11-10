import type { rpc } from "@stellar/stellar-sdk"

export interface RpcHealth {
  ok: boolean
  latestLedger: number | null
  latencyMs: number
  error?: string
}

export const HEALTH_TIMEOUT_MS = 3_000

class ProbeTimeout extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ProbeTimeout(`RPC did not answer within ${ms}ms`)),
      ms
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export async function probeRpc(
  server: Pick<rpc.Server, "getHealth" | "getLatestLedger">,
  opts: { timeoutMs?: number; now?: () => number } = {}
): Promise<RpcHealth> {
  const now = opts.now ?? (() => performance.now())
  const started = now()
  try {
    const [health, ledger] = await withTimeout(
      Promise.all([server.getHealth(), server.getLatestLedger()]),
      opts.timeoutMs ?? HEALTH_TIMEOUT_MS
    )
    const latencyMs = Math.round(now() - started)
    if (health.status !== "healthy") {
      return {
        ok: false,
        latestLedger: ledger.sequence,
        latencyMs,
        error: `RPC reports ${health.status}`,
      }
    }
    return { ok: true, latestLedger: ledger.sequence, latencyMs }
  } catch (error) {
    return {
      ok: false,
      latestLedger: null,
      latencyMs: Math.round(now() - started),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
