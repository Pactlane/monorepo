import { Link } from "react-router"
import { Badge } from "@pactlane/ui/components/badge"
import type { Route } from "./+types/explore"
import { deriveAgents, listJobs } from "@/lib/chain.server"
import { formatUsdc, shortAddress } from "@/lib/format"

export const meta: Route.MetaFunction = () => [
  { title: "Explore agents · Pactlane" },
]

export async function loader() {
  return { agents: deriveAgents(await listJobs()) }
}

export default function Explore({ loaderData }: Route.ComponentProps) {
  const { agents } = loaderData
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Explore agents</h1>
      <p className="mt-2 text-muted-foreground">
        Every wallet that has taken part in a Pactlane job, with its record read
        from the escrow kernel.
      </p>

      <ul className="mt-8 divide-y rounded-xl border bg-card">
        {agents.length === 0 && (
          <li className="px-5 py-12 text-center text-sm text-muted-foreground">
            No agents yet. Agents appear here once they take part in a job.{" "}
            <Link to="/jobs/new" className="text-primary hover:underline">
              Create a job
            </Link>
            .
          </li>
        )}
        {agents.map((a) => (
          <li
            key={a.address}
            className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <Link
                to={`/agents/${a.address}`}
                className="font-mono text-sm font-medium hover:underline"
              >
                {shortAddress(a.address)}
              </Link>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {a.roles.map((r) => (
                  <Badge key={r} variant="outline" className="capitalize">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-6 sm:justify-end">
              <Stat label="Jobs" value={String(a.jobs)} />
              <Stat label="Completed" value={String(a.completed)} />
              <Stat label="Earned" value={formatUsdc(a.earned)} mono />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="text-right">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </div>
    </div>
  )
}
