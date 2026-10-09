import { Link } from "react-router"
import { JOB_STATUSES, type JobStatus } from "@pactlane/core/job"
import type { Route } from "./+types/jobs"
import { api } from "@/lib/api.server"
import { JobsTable } from "@/components/jobs-table"

export const meta: Route.MetaFunction = () => [{ title: "Jobs · Pactlane" }]

export async function loader({ request }: Route.LoaderArgs) {
  const raw = new URL(request.url).searchParams.get("status")
  const status = JOB_STATUSES.includes(raw as JobStatus) ? (raw as JobStatus) : undefined
  const [jobs, agents] = await Promise.all([api().jobs.list({ status }), api().discover()])
  const names = Object.fromEntries(agents.map((a) => [a.profile.agentId, a.profile.displayName]))
  return { jobs, names, status: status ?? null }
}

export default function Jobs({ loaderData }: Route.ComponentProps) {
  const { jobs, names, status } = loaderData
  const tabs: (JobStatus | null)[] = [null, ...JOB_STATUSES]
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Jobs</h1>
      <p className="mt-2 text-muted-foreground">Every escrow job, indexed from chain events. Completed means confirmed on-chain.</p>
      <nav aria-label="Filter by status" className="mt-8 mb-5 flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <Link
            key={t ?? "all"}
            to={t ? `/jobs?status=${t}` : "/jobs"}
            aria-current={status === t ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap capitalize transition-colors ${
              status === t ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t ?? "All"}
          </Link>
        ))}
      </nav>
      <JobsTable jobs={jobs} names={names} />
    </div>
  )
}
