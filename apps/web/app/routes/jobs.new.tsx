import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { ArrowLeft, LoaderCircle } from "lucide-react"
import { Button } from "@pactlane/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@pactlane/ui/components/card"
import type { Route } from "./+types/jobs.new"
import { useWallet } from "@/lib/wallet-store"
import { connectWallet } from "@/lib/wallet.client"
import { outcomeMessage, runKernelCall, sha256Ref } from "@/lib/tx.client"

export const meta: Route.MetaFunction = () => [{ title: "New job · Pactlane" }]

const ADDRESS = /^[GC][A-Z2-7]{55}$/
const field =
  "h-10 w-full rounded-lg border bg-background px-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"

export default function NewJob() {
  const wallet = useWallet()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(undefined)
    const form = new FormData(event.currentTarget)
    const spec = String(form.get("spec") ?? "")
    const provider = String(form.get("provider") ?? "").trim()
    const evaluator = String(form.get("evaluator") ?? "").trim()
    const days = Number(form.get("days"))
    const client = wallet.address!
    if (!spec.trim()) return setError("Describe the task.")
    if (!ADDRESS.test(evaluator))
      return setError("Enter a valid evaluator address.")
    if (provider && !ADDRESS.test(provider)) {
      return setError("Enter a valid provider address or leave it empty.")
    }
    if (
      new Set([client, evaluator, provider || undefined]).size <
      (provider ? 3 : 2)
    ) {
      return setError(
        "Client, provider and evaluator must be different wallets."
      )
    }
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      return setError("Expiry must be between 1 and 90 days.")
    }
    setBusy(true)
    try {
      const outcome = await runKernelCall({
        method: "create_job",
        client,
        provider: provider || null,
        evaluator,
        expiresAt: Math.floor(Date.now() / 1000) + days * 86_400,
        specHash: await sha256Ref(spec),
      })
      if (outcome.status === "success" && outcome.value) {
        navigate(`/jobs/${outcome.value}`)
        return
      }
      setError(outcomeMessage(outcome))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All jobs
      </Link>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">New job</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Opens an escrow job on the Pactlane kernel with your wallet as the
        client. Nothing is charged until you fund it.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Job terms</CardTitle>
        </CardHeader>
        <CardContent>
          {wallet.status !== "connected" ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Connect the wallet that will pay for this job.</p>
              <Button variant="outline" onClick={() => void connectWallet()}>
                Connect wallet
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Task specification</span>
                <textarea
                  name="spec"
                  rows={5}
                  required
                  className="w-full rounded-lg border bg-background p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                  placeholder="What should the provider deliver?"
                />
                <span className="block text-xs text-muted-foreground">
                  Only its SHA-256 hash goes on-chain. Keep a copy to share with
                  the provider and evaluator.
                </span>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Evaluator address</span>
                <input
                  name="evaluator"
                  required
                  className={field}
                  placeholder="G..."
                />
                <span className="block text-xs text-muted-foreground">
                  Approves or rejects the work. Fixed for the job&apos;s life.
                </span>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">
                  Provider address{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </span>
                <input name="provider" className={field} placeholder="G..." />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Expires in (days)</span>
                <input
                  name="days"
                  type="number"
                  min={1}
                  max={90}
                  defaultValue={7}
                  className={field}
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" disabled={busy}>
                {busy && (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                )}
                Create job
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
