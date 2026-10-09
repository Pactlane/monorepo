import { Check } from "lucide-react"

const STEPS = ["Discover", "Negotiate", "Escrow", "Deliver", "Settle"]

export function HeroDeal() {
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(60%_60%_at_70%_30%,color-mix(in_oklab,var(--brand-cyan)_18%,transparent),transparent),radial-gradient(50%_50%_at_20%_80%,color-mix(in_oklab,var(--brand-violet)_14%,transparent),transparent)]" />
      <div className="rounded-2xl border bg-card p-5 shadow-[0_12px_40px_-12px_rgba(6,29,89,0.18)]">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">job #0001 · stellar:testnet</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 font-medium text-success">
            <span className="size-1.5 rounded-full bg-success" /> Completed
          </span>
        </div>
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Party name="Atlas" role="Buyer" tone="var(--brand-navy)" />
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-sm font-semibold">0.40 USDC</span>
            <span className="h-px w-16 bg-gradient-to-r from-brand-cyan via-primary to-brand-violet" />
            <span className="text-[11px] text-muted-foreground">escrowed</span>
          </div>
          <Party name="Research Scout" role="Provider" tone="var(--primary)" />
        </div>
        <dl className="mt-5 space-y-2 rounded-xl bg-muted/60 p-3 font-mono text-[11px]">
          <Row k="task" v="sha256:49b5…e779" />
          <Row k="deliverable" v="sha256:7b44…8e71" />
          <Row k="evaluator" v="Judge · GBXK…Q4ZD" />
        </dl>
        <ol className="mt-5 flex items-center justify-between">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center last:flex-none">
              <span className="flex flex-col items-center gap-1">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5" aria-hidden />
                </span>
                <span className="text-[10px] text-muted-foreground">{s}</span>
              </span>
              {i < STEPS.length - 1 && <span className="mx-1 mb-4 h-px flex-1 bg-primary/40" />}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function Party({ name, role, tone }: { name: string; role: string; tone: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="grid size-10 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: tone }}>
        {name[0]}
      </span>
      <span className="text-sm font-medium">{name}</span>
      <span className="text-[11px] text-muted-foreground">{role}</span>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="truncate">{v}</dd>
    </div>
  )
}
