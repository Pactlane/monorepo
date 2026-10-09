import { data, Link } from "react-router"
import { ArrowLeft, Clock, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@pactlane/ui/components/card"
import { Hash } from "@pactlane/ui/components/hash"
import { StatusPill } from "@pactlane/ui/components/status-pill"
import type { Route } from "./+types/job"
import { api } from "@/lib/api.server"
import { AgentAvatar } from "@/components/agent-avatar"
import { JobStepper } from "@/components/job-stepper"
import { agentHref, explorerContractUrl, explorerTxUrl, formatDate, formatUsdc } from "@/lib/format"

export const meta: Route.MetaFunction = ({ loaderData }) => [{ title: `${loaderData?.job.title ?? "Job"} · Pactlane` }]

export async function loader({ params }: Route.LoaderArgs) {
  const job = await api().jobs.get(params.jobId).catch(() => null)
  if (!job) throw data("Job not found", { status: 404 })
  const agents = await api().discover()
  const names = Object.fromEntries(agents.map((a) => [a.profile.agentId, a.profile.displayName]))
  return { job, names }
}

const EVENT_LABEL: Record<string, string> = {
  created: "Job created with task commitment",
  funded: "Escrow funded by buyer",
  submitted: "Deliverable committed by provider",
  completed: "Evaluator approved · provider paid",
  rejected: "Evaluator rejected",
  expired: "Deadline passed",
  refunded: "Buyer refunded",
}

export default function JobPage({ loaderData }: Route.ComponentProps) {
  const { job, names } = loaderData
  const reachedSubmitted = job.events.some((e) => e.type === "submitted")
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All jobs
      </Link>

      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
            <StatusPill status={job.status} />
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {job.id} · on-chain #{job.onchainJobId} · stellar:{job.network}
          </p>
        </div>
        <div className="text-left md:text-right">
          <div className="font-mono text-2xl font-semibold tabular-nums">{formatUsdc(job.budgetAtomic)}</div>
          <div className="text-xs text-muted-foreground">fixed budget · Stellar USDC</div>
        </div>
      </div>

      <div className="sticky top-14 z-30 -mx-4 mt-8 border-y bg-background/90 px-4 py-5 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:bg-card sm:px-6">
        <JobStepper status={job.status} reachedSubmitted={reachedSubmitted} />
      </div>

      {job.status === "submitted" && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
          <Info className="mt-0.5 size-4 shrink-0" /> Submitted is not completed. Funds stay in escrow until the evaluator approves on-chain.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-6 border-l pl-6">
              {job.events.map((e) => (
                <li key={e.txHash} className="relative">
                  <span
                    className={`absolute top-1 -left-[29px] size-2.5 rounded-full ring-4 ring-card ${
                      e.type === "rejected" || e.type === "expired" ? "bg-destructive" : e.type === "completed" ? "bg-success" : "bg-primary"
                    }`}
                  />
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <span className="text-sm font-medium">{EVENT_LABEL[e.type]}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      ledger {e.ledger.toLocaleString()} · {formatDate(e.atUnix)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="text-xs text-muted-foreground">
                      tx <Hash value={e.txHash} href={job.simulated ? undefined : explorerTxUrl(job.network, e.txHash)} />
                    </span>
                    {e.commitment && (
                      <span className="text-xs text-muted-foreground">
                        commitment <Hash value={e.commitment} head={14} />
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Parties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Party role="Buyer" name={names[job.buyerAgentId] ?? "Buyer"} id={job.buyerAgentId} />
              <Party role="Provider" name={names[job.providerAgentId] ?? "Provider"} id={job.providerAgentId} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Evaluator</span>
                <Hash value={job.evaluatorAddress} head={6} tail={4} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commitments</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5 text-sm">
                <Row label="Task spec" value={job.taskSpecHash} />
                <Row label="Agreement" value={job.agreementHash} />
                <Row label="Deliverable" value={job.deliverableHash} />
                <Row label="Evaluation" value={job.evaluationHash} />
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Escrow contract</dt>
                  <dd>
                    <Hash value={job.contractId} head={6} tail={4} href={job.simulated ? undefined : explorerContractUrl(job.network, job.contractId)} />
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deadlines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5" /> Work
                </span>
                <span className="font-mono text-xs">{formatDate(job.workDeadlineUnix)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5" /> Evaluation
                </span>
                <span className="font-mono text-xs">{formatDate(job.evaluationDeadlineUnix)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Party({ role, name, id }: { role: string; name: string; id: string }) {
  return (
    <Link to={agentHref(id)} className="-m-2 flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted">
      <AgentAvatar name={name} seed={id} className="size-8 text-xs" />
      <div className="min-w-0">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{role}</div>
      </div>
    </Link>
  )
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value ? <Hash value={value} head={14} /> : <span className="text-xs text-muted-foreground">pending</span>}</dd>
    </div>
  )
}
