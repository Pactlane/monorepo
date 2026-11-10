import { Link } from "react-router"
import { StatusPill } from "@pactlane/ui/components/status-pill"
import type { JobView } from "@/lib/chain.server"
import { formatDate, formatUsdc, shortAddress } from "@/lib/format"

export function JobsTable({
  jobs,
  empty = "No jobs on the kernel yet.",
}: {
  jobs: JobView[]
  empty?: React.ReactNode
}) {
  if (!jobs.length) {
    return (
      <div className="rounded-xl border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-5 py-2.5 font-medium">
              Job
            </th>
            <th scope="col" className="px-5 py-2.5 font-medium">
              Status
            </th>
            <th
              scope="col"
              className="hidden px-5 py-2.5 font-medium md:table-cell"
            >
              Client → Provider
            </th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">
              Budget
            </th>
            <th
              scope="col"
              className="hidden px-5 py-2.5 text-right font-medium sm:table-cell"
            >
              Expires
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {jobs.map((j) => (
            <tr key={j.id} className="transition-colors hover:bg-muted/40">
              <td className="px-5 py-3">
                <Link
                  to={`/jobs/${j.id}`}
                  className="font-mono font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  #{j.id}
                </Link>
              </td>
              <td className="px-5 py-3">
                <StatusPill status={j.status} />
              </td>
              <td className="hidden px-5 py-3 font-mono text-xs text-muted-foreground md:table-cell">
                {shortAddress(j.client)} →{" "}
                {j.provider ? shortAddress(j.provider) : "unassigned"}
              </td>
              <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">
                {j.budget === "0" ? "not set" : formatUsdc(j.budget)}
              </td>
              <td className="hidden px-5 py-3 text-right font-mono text-xs text-muted-foreground sm:table-cell">
                {formatDate(j.expiresAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
