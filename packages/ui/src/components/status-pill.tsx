import { cn } from "cn"

export type Status = "open" | "funded" | "submitted" | "completed" | "rejected" | "expired"

const STYLES: Record<Status, { label: string; dot: string; text: string }> = {
  open: { label: "Open", dot: "bg-muted-foreground", text: "text-muted-foreground bg-muted" },
  funded: { label: "Funded", dot: "bg-primary", text: "text-accent-foreground bg-accent" },
  submitted: { label: "Submitted", dot: "bg-warning", text: "text-warning bg-warning-soft" },
  completed: { label: "Completed", dot: "bg-success", text: "text-success bg-success-soft" },
  rejected: { label: "Rejected", dot: "bg-destructive", text: "text-destructive bg-danger-soft" },
  expired: { label: "Expired", dot: "bg-muted-foreground", text: "text-muted-foreground bg-muted" },
}

function StatusPill({ status, className }: { status: Status; className?: string }) {
  const s = STYLES[status]
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", s.text, className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  )
}

export { StatusPill }
