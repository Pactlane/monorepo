import { cn } from "cn"

interface LogoProps {
  className?: string
  size?: number
  withWordmark?: boolean
  src?: string
}

function Logo({ className, size = 28, withWordmark = true, src = "/brand/pactlane-symbol.svg" }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img src={src} width={size} height={size} alt={withWordmark ? "" : "Pactlane"} className="shrink-0" />
      {withWordmark && <span className="text-[1.05rem] font-semibold tracking-tight">Pactlane</span>}
    </span>
  )
}

export { Logo }
