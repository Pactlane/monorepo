import { Hash } from "@pactlane/ui/components/hash"
import { explorerContractUrl, formatUsdc } from "@/lib/format"

export function ProtocolCard({
  kernel,
  evaluationPolicy,
  token,
  total,
  escrowed,
}: {
  kernel: string
  evaluationPolicy: string
  token: string
  total: number
  escrowed: string
}) {
  const rows = [
    { label: "Escrow kernel", value: kernel },
    { label: "Evaluation policy", value: evaluationPolicy },
    { label: "Payment token (USDC)", value: token },
  ]
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(60%_60%_at_70%_30%,color-mix(in_oklab,var(--brand-cyan)_18%,transparent),transparent),radial-gradient(50%_50%_at_20%_80%,color-mix(in_oklab,var(--brand-violet)_14%,transparent),transparent)]"
      />
      <div className="rounded-2xl border bg-card p-5 shadow-[0_12px_40px_-12px_rgba(6,29,89,0.18)]">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">pactlane · stellar:testnet</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 font-medium text-success">
            <span className="size-1.5 rounded-full bg-success" /> Live
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat label="Jobs on the kernel" value={String(total)} />
          <Stat label="In escrow now" value={formatUsdc(escrowed)} />
        </div>
        <dl className="mt-5 space-y-2.5 rounded-xl bg-muted/60 p-3 text-xs">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-3"
            >
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd>
                <Hash
                  value={r.value}
                  head={6}
                  tail={4}
                  href={explorerContractUrl("testnet", r.value)}
                />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="font-mono text-lg font-semibold tabular-nums">
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}
