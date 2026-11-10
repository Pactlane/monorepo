import { TransactionBuilder, rpc, type xdr } from "@stellar/stellar-sdk"

export type SubmitRpc = Pick<rpc.Server, "sendTransaction" | "getTransaction">

export interface SubmitOptions {
  networkPassphrase: string
  timeoutMs?: number
  initialDelayMs?: number
  maxDelayMs?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

export type SubmitResult =
  | {
      status: "success"
      hash: string
      ledger: number
      returnValue?: xdr.ScVal
      response: rpc.Api.GetSuccessfulTransactionResponse
    }
  | {
      status: "failed"
      hash: string
      ledger: number
      response: rpc.Api.GetFailedTransactionResponse
    }
  | {
      status: "rejected"
      hash: string
      errorResult?: xdr.TransactionResult
      diagnosticEvents: xdr.DiagnosticEvent[]
    }
  | { status: "try_again_later"; hash: string }
  | { status: "unknown"; hash: string }

export const DEFAULT_SUBMIT_TIMEOUT_MS = 60_000

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export async function submitAndWait(
  server: SubmitRpc,
  signedXdr: string,
  opts: SubmitOptions
): Promise<SubmitResult> {
  const tx = TransactionBuilder.fromXDR(signedXdr, opts.networkPassphrase)
  const hash = toHex(tx.hash())
  let sent: rpc.Api.SendTransactionResponse | undefined
  try {
    sent = await server.sendTransaction(tx)
  } catch {
    // The request may still have reached the network: reconcile by hash.
  }
  if (sent?.status === "ERROR") {
    return {
      status: "rejected",
      hash,
      errorResult: sent.errorResult,
      diagnosticEvents: sent.diagnosticEvents ?? [],
    }
  }
  if (sent?.status === "TRY_AGAIN_LATER") {
    const known = settled(hash, await getSafe(server, hash))
    return known ?? { status: "try_again_later", hash }
  }
  return pollTransaction(server, hash, opts)
}

function getSafe(server: Pick<SubmitRpc, "getTransaction">, hash: string) {
  return server.getTransaction(hash).catch(() => undefined)
}

function settled(
  hash: string,
  res: rpc.Api.GetTransactionResponse | undefined
): SubmitResult | undefined {
  if (res?.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    return {
      status: "success",
      hash,
      ledger: res.ledger,
      returnValue: res.returnValue,
      response: res,
    }
  }
  if (res?.status === rpc.Api.GetTransactionStatus.FAILED) {
    return { status: "failed", hash, ledger: res.ledger, response: res }
  }
  return undefined
}

export async function pollTransaction(
  server: Pick<SubmitRpc, "getTransaction">,
  hash: string,
  opts: Omit<SubmitOptions, "networkPassphrase"> = {}
): Promise<SubmitResult> {
  const now = opts.now ?? Date.now
  const sleep = opts.sleep ?? defaultSleep
  const maxDelay = opts.maxDelayMs ?? 10_000
  let delay = opts.initialDelayMs ?? 1_000
  if (!(delay > 0) || !(maxDelay >= delay)) {
    throw new RangeError("Polling delays must satisfy 0 < initial <= max")
  }
  const deadline = now() + (opts.timeoutMs ?? DEFAULT_SUBMIT_TIMEOUT_MS)

  for (;;) {
    const remaining = deadline - now()
    if (remaining <= 0) return { status: "unknown", hash }
    await sleep(Math.min(delay, remaining))
    delay = Math.min(delay * 2, maxDelay)

    const known = settled(hash, await getSafe(server, hash))
    if (known) return known
  }
}
