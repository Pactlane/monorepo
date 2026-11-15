import { signWithWallet } from "./wallet.client"
import { getWalletState } from "./wallet-store"

export type CallInput = { method: string } & Record<
  string,
  string | number | null | undefined
>

export type TxOutcome =
  | { status: "success"; hash: string; ledger: number; value: string | null }
  | {
      status: "failed" | "rejected" | "try_again_later" | "unknown"
      hash: string
    }

async function post<T>(payload: unknown): Promise<T> {
  const res = await fetch("/api/tx", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok || json.error) {
    throw new Error(json.error ?? `Request failed (${res.status})`)
  }
  return json
}

export async function runKernelCall(call: CallInput): Promise<TxOutcome> {
  const source = getWalletState().address
  if (!source) throw new Error("Connect a wallet first")
  const { xdr } = await post<{ xdr: string }>({
    intent: "prepare",
    source,
    call,
  })
  const signed = await signWithWallet(xdr)
  return post<TxOutcome>({ intent: "submit", xdr: signed })
}

export async function sha256Ref(text: string): Promise<string> {
  const trimmed = text.trim()
  if (/^sha256:[0-9a-f]{64}$/.test(trimmed)) return trimmed
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(trimmed)
  )
  const hex = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("")
  return `sha256:${hex}`
}

export function outcomeMessage(outcome: TxOutcome): string {
  switch (outcome.status) {
    case "success":
      return `Confirmed in ledger ${outcome.ledger}.`
    case "failed":
      return "The transaction was included but failed on-chain."
    case "rejected":
      return "The network rejected the transaction."
    case "try_again_later":
      return "The network is busy. Try again in a moment."
    case "unknown":
      return "Not confirmed yet. Check the explorer before retrying."
  }
}
