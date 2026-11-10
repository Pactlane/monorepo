import { useState } from "react"
import { useRevalidator } from "react-router"
import { LoaderCircle } from "lucide-react"
import { toAtomic } from "@pactlane/core/money"
import { Button } from "@pactlane/ui/components/button"
import type { JobView } from "@/lib/chain.server"
import { useWallet } from "@/lib/wallet-store"
import { connectWallet } from "@/lib/wallet.client"
import {
  outcomeMessage,
  runKernelCall,
  sha256Ref,
  type CallInput,
} from "@/lib/tx.client"
import { fromAtomic } from "@pactlane/core/money"

type Method =
  | "set_provider"
  | "set_budget"
  | "fund"
  | "submit"
  | "complete"
  | "reject"
  | "claim_refund"

const LABELS: Record<Method, string> = {
  set_provider: "Set provider",
  set_budget: "Propose budget",
  fund: "Fund escrow",
  submit: "Submit work",
  complete: "Approve and pay",
  reject: "Reject",
  claim_refund: "Claim refund",
}

export function availableActions(
  job: JobView,
  address: string | undefined,
  nowSeconds: number
): Method[] {
  const live = nowSeconds < job.expiresAt
  const actions: Method[] = []
  const isClient = address === job.client
  const isProvider = !!address && address === job.provider
  const isEvaluator = address === job.evaluator
  if (job.status === "open") {
    if (isClient && !job.provider && live) actions.push("set_provider")
    if ((isClient || isProvider) && live) actions.push("set_budget")
    if (isClient && job.provider && job.budget !== "0" && live) {
      actions.push("fund")
    }
    if (isClient) actions.push("reject")
  } else if (job.status === "funded" || job.status === "submitted") {
    if (!live) actions.push("claim_refund")
    else if (job.status === "funded" && isProvider) actions.push("submit")
    if (live && isEvaluator) {
      if (job.status === "submitted") actions.push("complete")
      actions.push("reject")
    }
  }
  return actions
}

const field =
  "h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"

export function JobActions({ job }: { job: JobView }) {
  const wallet = useWallet()
  const { revalidate } = useRevalidator()
  const [busy, setBusy] = useState<Method>()
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()
  const [input, setInput] = useState("")

  if (wallet.status !== "connected" || !wallet.address) {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          Connect the client, provider or evaluator wallet to act on this job.
        </p>
        <Button variant="outline" onClick={() => void connectWallet()}>
          Connect wallet
        </Button>
      </div>
    )
  }

  const actions = availableActions(
    job,
    wallet.address,
    Math.floor(Date.now() / 1000)
  )
  if (!actions.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing for this wallet to do on this job right now.
      </p>
    )
  }

  const needsInput = (m: Method) =>
    m === "set_provider" ||
    m === "set_budget" ||
    m === "submit" ||
    m === "complete"

  const placeholder: Partial<Record<Method, string>> = {
    set_provider: "Provider address (G...)",
    set_budget: "Budget in USDC, e.g. 12.50",
    submit: "Deliverable text, link or sha256:...",
    complete: "Reason or evaluation note (hashed)",
  }

  async function build(method: Method): Promise<CallInput> {
    const id = job.id
    switch (method) {
      case "set_provider":
        return { method, id, provider: input.trim() }
      case "set_budget":
        return {
          method,
          id,
          actor: wallet.address!,
          amount: toAtomic(input).toString(),
        }
      case "fund":
        return { method, id, expectedBudget: job.budget }
      case "submit":
        return { method, id, workHash: await sha256Ref(input) }
      case "complete":
        return { method, id, reason: await sha256Ref(input) }
      case "reject":
        return {
          method,
          id,
          reason: input.trim() ? await sha256Ref(input) : null,
        }
      case "claim_refund":
        return { method, id }
    }
  }

  async function run(method: Method) {
    setMessage(undefined)
    if (needsInput(method) && !input.trim()) {
      setMessage({ ok: false, text: placeholder[method]! })
      return
    }
    setBusy(method)
    try {
      const outcome = await runKernelCall(await build(method))
      setMessage({
        ok: outcome.status === "success",
        text: outcomeMessage(outcome),
      })
      if (outcome.status === "success") {
        setInput("")
        revalidate()
      }
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setBusy(undefined)
    }
  }

  const inputFor = actions.find(needsInput)
  return (
    <div className="space-y-3">
      {job.status === "open" && job.budget !== "0" && (
        <p className="text-xs text-muted-foreground">
          Current budget {fromAtomic(job.budget)} USDC. Funding transfers
          exactly this amount into escrow.
        </p>
      )}
      {(inputFor || actions.includes("reject")) && (
        <input
          aria-label={inputFor ? placeholder[inputFor] : "Rejection reason"}
          placeholder={
            inputFor ? placeholder[inputFor] : "Rejection reason (optional)"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={field}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map((m) => (
          <Button
            key={m}
            variant={m === "reject" ? "destructive" : "default"}
            disabled={!!busy}
            onClick={() => void run(m)}
          >
            {busy === m && (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            )}
            {LABELS[m]}
          </Button>
        ))}
      </div>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`text-sm ${message.ok ? "text-success" : "text-destructive"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
