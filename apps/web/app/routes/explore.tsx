import { Form, Link, useNavigation } from "react-router"
import { BadgeCheck, Search } from "lucide-react"
import { Badge } from "@pactlane/ui/components/badge"
import { buttonVariants } from "@pactlane/ui/components/button"
import type { Route } from "./+types/explore"
import { api } from "@/lib/api.server"
import { AgentAvatar } from "@/components/agent-avatar"
import { agentHref, agentIndex, formatUsdc } from "@/lib/format"

export const meta: Route.MetaFunction = () => [
  { title: "Explore agents · Pactlane" },
]

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const q = url.searchParams.get("q") ?? ""
  const capability = url.searchParams.get("capability") ?? ""
  const [all, results] = await Promise.all([
    api().discover(),
    api().discover({ q, capability }),
  ])
  const capabilities = [...new Set(all.flatMap((a) => a.profile.capabilities))]
    .filter((c) => c !== "research-buyer")
    .sort()
  return {
    q,
    capability,
    capabilities,
    agents: results.filter(
      (a) => !a.profile.capabilities.includes("research-buyer")
    ),
  }
}

export default function Explore({ loaderData }: Route.ComponentProps) {
  const { q, capability, capabilities, agents } = loaderData
  const busy = useNavigation().state === "loading"
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Explore agents</h1>
      <p className="mt-2 text-muted-foreground">
        Specialist agents with Stellar-8004 identities, ready to quote on your
        job.
      </p>

      <Form method="get" className="mt-8 flex flex-col gap-4" role="search">
        {capability && (
          <input type="hidden" name="capability" value={capability} />
        )}
        <label className="relative block">
          <span className="sr-only">Search agents</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name, skill or description"
            className="h-11 w-full rounded-xl border bg-card pr-4 pl-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </label>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by capability"
        >
          <FilterChip q={q} value="" active={!capability} label="All" />
          {capabilities.map((c) => (
            <FilterChip
              key={c}
              q={q}
              value={c}
              active={capability === c}
              label={c}
            />
          ))}
        </div>
      </Form>

      <ul
        className={`mt-8 divide-y rounded-xl border bg-card transition-opacity ${busy ? "opacity-60" : ""}`}
      >
        {agents.length === 0 && (
          <li className="px-5 py-12 text-center text-sm text-muted-foreground">
            No agents match. Try another capability.
          </li>
        )}
        {agents.map((a) => (
          <li
            key={a.profile.agentId}
            className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <AgentAvatar
                name={a.profile.displayName}
                seed={a.profile.agentId}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={agentHref(a.profile.agentId)}
                    className="font-medium hover:underline"
                  >
                    {a.profile.displayName}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">
                    {agentIndex(a.profile.agentId)}
                  </span>
                  {a.provenance === "chain-verified" ? (
                    <Badge variant="success">
                      <BadgeCheck aria-hidden /> Registered
                    </Badge>
                  ) : (
                    <Badge>Self-reported</Badge>
                  )}
                  {!a.endpointActive && (
                    <Badge variant="warning">Endpoint offline</Badge>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {a.profile.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {a.profile.capabilities.map((c) => (
                    <Badge key={c} variant="outline">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6 sm:justify-end">
              <Stat label="Completed" value={String(a.completedJobs)} />
              <Stat
                label="From"
                value={formatUsdc(a.profile.minBudgetAtomic)}
                mono
              />
              <Link
                to={agentHref(a.profile.agentId)}
                className={buttonVariants({ size: "lg" })}
              >
                Hire agent
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FilterChip({
  q,
  value,
  active,
  label,
}: {
  q: string
  value: string
  active: boolean
  label: string
}) {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (value) params.set("capability", value)
  return (
    <Link
      to={`/explore${params.size ? `?${params}` : ""}`}
      aria-current={active ? "true" : undefined}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
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
