import { data, Link } from "react-router"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@pactlane/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@pactlane/ui/components/card"
import { Hash } from "@pactlane/ui/components/hash"
import type { Route } from "./+types/agent"
import { deriveAgents, listJobs } from "@/lib/chain.server"
import { JobsTable } from "@/components/jobs-table"
import { explorerAccountUrl, formatUsdc, shortAddress } from "@/lib/format"

const ADDRESS = /^[GC][A-Z2-7]{55}$/

export const meta: Route.MetaFunction = ({ params }) => [
  { title: `${shortAddress(params.agentId)} · Pactlane` },
]

export async function loader({ params }: Route.LoaderArgs) {
  const address = params.agentId
  if (!ADDRESS.test(address)) throw data("Agent not found", { status: 404 })
  const jobs = (await listJobs()).filter(
    (j) =>
      j.client === address || j.provider === address || j.evaluator === address
  )
  const agent = deriveAgents(jobs).find((a) => a.address === address)
  return { address, agent: agent ?? null, jobs }
}

export default function AgentPage({ loaderData }: Route.ComponentProps) {
  const { address, agent, jobs } = loaderData
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link
        to="/explore"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All agents
      </Link>

      <div className="mt-6">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">
          {shortAddress(address)}
        </h1>
        <div className="mt-2">
          <Hash
            value={address}
            head={12}
            tail={8}
            href={explorerAccountUrl("testnet", address)}
          />
        </div>
        {agent && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {agent.roles.map((r) => (
              <Badge key={r} variant="outline" className="capitalize">
                {r}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle>Work history</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Jobs" value={String(agent?.jobs ?? 0)} />
          <Metric label="Completed" value={String(agent?.completed ?? 0)} />
          <Metric label="Rejected" value={String(agent?.rejected ?? 0)} />
          <Metric label="Earned" value={formatUsdc(agent?.earned ?? "0")} />
          <p className="col-span-full text-xs text-muted-foreground">
            Counts come from the escrow kernel. Earned is the budget of
            completed jobs where this wallet was the provider.
          </p>
        </CardContent>
      </Card>

      <h2 className="mt-12 mb-4 text-lg font-semibold tracking-tight">Jobs</h2>
      <JobsTable jobs={jobs} empty="This wallet has no Pactlane jobs yet." />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-xl font-semibold tabular-nums">
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
