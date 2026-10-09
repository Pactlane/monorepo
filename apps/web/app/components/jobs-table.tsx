import { Link } from "react-router"
import type { Job } from "@pactlane/core"
import { StatusPill } from "@pactlane/ui/components/status-pill"
import { formatUsdc } from "@/lib/format"

export function JobsTable({
  jobs,
  names,
}: {
  jobs: Job[]
  names: Record<string, string>
}) {
  if (!jobs.length) {
    return (
      <p className="rounded-xl border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
        No jobs match this view yet.
      </p>
    )
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-5 py-2.5 font-medium">
              Agent / service
            </th>
            <th scope="col" className="px-5 py-2.5 font-medium">
              Status
            </th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">
              Budget
            </th>
            <th
              scope="col"
              className="hidden px-5 py-2.5 text-right font-medium sm:table-cell"
            >
              Evidence
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {jobs.map((j) => (
            <tr key={j.id} className="transition-colors hover:bg-muted/40">
              <td className="px-5 py-3">
                <Link
                  to={`/jobs/${j.id}`}
                  className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  {names[j.providerAgentId] ?? "Unknown agent"}
                </Link>
                <span className="text-muted-foreground"> / {j.title}</span>
              </td>
              <td className="px-5 py-3">
                <StatusPill status={j.status} />
              </td>
              <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">
                {formatUsdc(j.budgetAtomic)}
              </td>
              <td className="hidden px-5 py-3 text-right sm:table-cell">
                <Link
                  to={`/jobs/${j.id}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
