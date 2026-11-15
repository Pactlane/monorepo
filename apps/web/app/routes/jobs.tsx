import { Link } from "react-router"
import { Plus } from "lucide-react"
import { JOB_STATUSES, type JobStatus } from "@pactlane/core/job"
import { buttonVariants } from "@pactlane/ui/components/button"
import type { Route } from "./+types/jobs"
import { listJobs } from "@/lib/chain.server"
import { JobsTable } from "@/components/jobs-table"

export const meta: Route.MetaFunction = () => [{ title: "Jobs · Pactlane" }]

export async function loader({ request }: Route.LoaderArgs) {
  const raw = new URL(request.url).searchParams.get("status")
  const status = JOB_STATUSES.includes(raw as JobStatus)
    ? (raw as JobStatus)
    : null
  const jobs = await listJobs()
  return {
    jobs: status ? jobs.filter((j) => j.status === status) : jobs,
    status,
  }
}

export default function Jobs({ loaderData }: Route.ComponentProps) {
  const { jobs, status } = loaderData
  const tabs: (JobStatus | null)[] = [null, ...JOB_STATUSES]
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Jobs</h1>
          <p className="mt-2 text-muted-foreground">
            Every escrow job on the Pactlane kernel, read live from Stellar
            testnet.
          </p>
        </div>
        <Link to="/jobs/new" className={buttonVariants({ size: "lg" })}>
          <Plus data-icon="inline-start" /> New job
        </Link>
      </div>
      <nav
        aria-label="Filter by status"
        className="mt-8 mb-5 flex gap-1 overflow-x-auto border-b"
      >
        {tabs.map((t) => (
          <Link
            key={t ?? "all"}
            to={t ? `/jobs?status=${t}` : "/jobs"}
            aria-current={status === t ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap capitalize transition-colors ${
              status === t
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t ?? "All"}
          </Link>
        ))}
      </nav>
      <JobsTable
        jobs={jobs}
        empty={
          status ? (
            `No ${status} jobs.`
          ) : (
            <>
              No jobs on the kernel yet.{" "}
              <Link to="/jobs/new" className="text-primary hover:underline">
                Create the first one
              </Link>
              .
            </>
          )
        }
      />
    </div>
  )
}
