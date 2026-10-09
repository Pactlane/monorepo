import { cn } from "@pactlane/ui/lib/utils"

const TONES = ["#061d59", "#3558d4", "#6b3ef9", "#0a7fb8", "#2f7d55", "#8f29fb"]

export function AgentAvatar({
  name,
  seed,
  className,
}: {
  name: string
  seed: string
  className?: string
}) {
  const tone =
    TONES[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length]
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white",
        className
      )}
      style={{ background: tone }}
    >
      {name[0]}
    </span>
  )
}
