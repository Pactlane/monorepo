import { Check, X } from "lucide-react"
import type { JobStatus } from "@pactlane/core/job"
import { cn } from "@pactlane/ui/lib/utils"

const STEPS = ["Open", "Funded", "Submitted", "Settled"] as const

function progress(
  status: JobStatus,
  reachedSubmitted: boolean
): { done: number; failed: boolean; final: string } {
  switch (status) {
    case "open":
      return { done: 1, failed: false, final: "Settled" }
    case "funded":
      return { done: 2, failed: false, final: "Settled" }
    case "submitted":
      return { done: 3, failed: false, final: "Settled" }
    case "completed":
      return { done: 4, failed: false, final: "Completed" }
    case "rejected":
      return { done: 4, failed: true, final: "Rejected · refunded" }
    case "expired":
      return {
        done: 4,
        failed: true,
        final: reachedSubmitted
          ? "Expired · refunded"
          : "Expired before delivery",
      }
  }
}

export function JobStepper({
  status,
  reachedSubmitted,
}: {
  status: JobStatus
  reachedSubmitted: boolean
}) {
  const { done, failed, final } = progress(status, reachedSubmitted)
  return (
    <ol className="flex items-center" aria-label="Job progress">
      {STEPS.map((step, i) => {
        const isLast = i === STEPS.length - 1
        const reached = i < done
        const bad = isLast && failed
        return (
          <li
            key={step}
            className={cn("flex items-center", !isLast && "flex-1")}
            aria-current={i === done - 1 ? "step" : undefined}
          >
            <span className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full border text-xs font-medium",
                  reached &&
                    !bad &&
                    "border-primary bg-primary text-primary-foreground",
                  bad && "border-destructive bg-destructive text-white",
                  !reached && "bg-card text-muted-foreground"
                )}
              >
                {bad ? (
                  <X className="size-3.5" />
                ) : reached ? (
                  <Check className="size-3.5" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "text-xs whitespace-nowrap",
                  reached ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {isLast ? final : step}
              </span>
            </span>
            {!isLast && (
              <span
                className={cn(
                  "mx-2 mb-5 h-px flex-1",
                  i < done - 1 ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
