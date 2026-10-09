import { data, Link } from "react-router"
import { ArrowLeft, BadgeCheck, Globe, Radio } from "lucide-react"
import { Badge } from "@pactlane/ui/components/badge"
import { Button } from "@pactlane/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@pactlane/ui/components/card"
import { Hash } from "@pactlane/ui/components/hash"
import type { Route } from "./+types/agent"
import { api } from "@/lib/api.server"
import { AgentAvatar } from "@/components/agent-avatar"
import { JobsTable } from "@/components/jobs-table"
import { agentIndex, explorerContractUrl, formatUsdc } from "@/lib/format"

export const meta: Route.MetaFunction = ({ loaderData }) => [{ title: `${loaderData?.agent.profile.displayName ?? "Agent"} · Pactlane` }]

export async function loader({ params }: Route.LoaderArgs) {
  const agent = await api().agent(params.agentId).catch(() => null)
  if (!agent) throw data("Agent not found", { status: 404 })
  const [jobs, all] = await Promise.all([api().jobs.list({ agent: params.agentId }), api().discover()])
  const names = Object.fromEntries(all.map((a) => [a.profile.agentId, a.profile.displayName]))
  return { agent, jobs, names }
}

export default function AgentPage({ loaderData }: Route.ComponentProps) {
  const { agent, jobs, names } = loaderData
  const p = agent.profile
  const registry = p.agentId.split(":")[2]!.split("#")[0]!
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link to="/explore" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All agents
      </Link>

      <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <AgentAvatar name={p.displayName} seed={p.agentId} className="size-14 text-lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{p.displayName}</h1>
              <span className="font-mono text-sm text-muted-foreground">{agentIndex(p.agentId)}</span>
              {agent.provenance === "chain-verified" ? (
                <Badge variant="success">
                  <BadgeCheck aria-hidden /> Registered on Stellar-8004
                </Badge>
              ) : (
                <Badge>Self-reported</Badge>
              )}
            </div>
            <p className="mt-2 max-w-2xl text-muted-foreground">{p.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.capabilities.map((c) => (
                <Badge key={c} variant="outline">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <Button size="lg" className="h-10 px-4" disabled title="Quotes open with testnet wallet support">
            Request quote
          </Button>
          <span className="text-xs text-muted-foreground">from {formatUsdc(p.minBudgetAtomic)}</span>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Work history</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <Metric label="Completed" value={agent.completedJobs} />
            <Metric label="Rejected" value={agent.rejectedJobs} />
            <Metric label="Max concurrent" value={p.maxConcurrentJobs} />
            <p className="col-span-3 text-xs text-muted-foreground">
              Counts come from finalized escrow jobs. Reputation is advisory and never authorizes settlement.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <Field label="Registry">
                <Hash value={registry} href={explorerContractUrl("testnet", registry)} />
              </Field>
              <Field label="Owner">
                <Hash value={p.ownerAddress} />
              </Field>
              <Field label="Payout wallet">
                <Hash value={p.providerWallet} />
              </Field>
              <Field label="Comm key">
                <Hash value={p.communicationKey} />
              </Field>
              <Field label="Transport">
                <span className="inline-flex items-center gap-1.5 text-xs">
                  {agent.endpointActive ? <Radio className="size-3.5 text-success" /> : <Radio className="size-3.5 text-warning" />}
                  {agent.endpointActive ? "Endpoint healthy" : "Endpoint offline"}
                </span>
              </Field>
              {p.serviceEndpoint && (
                <Field label="Endpoint">
                  <span className="inline-flex items-center gap-1 font-mono text-xs">
                    <Globe className="size-3" /> {new URL(p.serviceEndpoint).host}
                  </span>
                </Field>
              )}
              <Field label="Assets">
                <span className="font-mono text-xs">{p.supportedAssets.join(", ")}</span>
              </Field>
            </dl>
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-12 mb-4 text-lg font-semibold tracking-tight">Jobs</h2>
      <JobsTable jobs={jobs} names={names} />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
