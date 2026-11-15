import { data, Link } from "react-router"
import { ArrowLeft, Clock, Info } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@pactlane/ui/components/card"
import { Hash } from "@pactlane/ui/components/hash"
import { StatusPill } from "@pactlane/ui/components/status-pill"
import type { Route } from "./+types/job"
import { DEPLOYMENT, getJob } from "@/lib/chain.server"
import { JobActions } from "@/components/job-actions"
import { JobStepper } from "@/components/job-stepper"
import {
  explorerAccountUrl,
  explorerContractUrl,
  formatDate,
  formatUsdc,
} from "@/lib/format"

export const meta: Route.MetaFunction = ({ params }) => [
  { title: `Job #${params.jobId} · Pactlane` },
]

export async function loader({ params }: Route.LoaderArgs) {
  const job = await getJob(params.jobId)
  if (!job) throw data("Job not found", { status: 404 })
  return { job, kernel: DEPLOYMENT.kernel }
}

export default function JobPage({ loaderData }: Route.ComponentProps) {
  const { job, kernel } = loaderData
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All jobs
      </Link>

      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">
              Job #{job.id}
            </h1>
            <StatusPill status={job.status} />
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            pactlane-commerce · stellar:testnet
          </p>
        </div>
        <div className="text-left md:text-right">
          <div className="font-mono text-2xl font-semibold tabular-nums">
            {job.budget === "0" ? "Budget not set" : formatUsdc(job.budget)}
          </div>
          <div className="text-xs text-muted-foreground">
            {job.status === "open" ? "proposed budget" : "escrowed budget"} ·
            Stellar USDC
          </div>
        </div>
      </div>

      <div className="sticky top-14 z-30 -mx-4 mt-8 border-y bg-background/90 px-4 py-5 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:bg-card sm:px-6">
        <JobStepper status={job.status} reachedSubmitted={!!job.workHash} />
      </div>

      {job.status === "submitted" && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
          <Info className="mt-0.5 size-4 shrink-0" /> Submitted is not
          completed. Funds stay in escrow until the evaluator approves on-chain.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <JobActions job={job} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Commitments</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5 text-sm">
                <Row label="Task spec" value={job.specHash} />
                <Row label="Deliverable" value={job.workHash} />
                <Row label="Settlement reason" value={job.reason} />
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Escrow contract</dt>
                  <dd>
                    <Hash
                      value={kernel}
                      head={6}
                      tail={4}
                      href={explorerContractUrl("testnet", kernel)}
                    />
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Parties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Party role="Client" address={job.client} />
              <Party role="Provider" address={job.provider} />
              <Party role="Evaluator" address={job.evaluator} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Deadline</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock className="size-3.5" /> Expires
              </span>
              <span className="font-mono text-xs">
                {formatDate(job.expiresAt)}
              </span>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Party({ role, address }: { role: string; address: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      {address ? (
        <Link
          to={`/agents/${address}`}
          className="text-muted-foreground hover:underline"
        >
          {role}
        </Link>
      ) : (
        <span className="text-muted-foreground">{role}</span>
      )}
      {address ? (
        <Hash
          value={address}
          head={6}
          tail={4}
          href={explorerAccountUrl("testnet", address)}
        />
      ) : (
        <span className="text-xs text-muted-foreground">not set</span>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        {value ? (
          <Hash value={value} head={14} />
        ) : (
          <span className="text-xs text-muted-foreground">pending</span>
        )}
      </dd>
    </div>
  )
}
