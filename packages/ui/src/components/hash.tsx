import { useState } from "react"
import { Check, Copy, ExternalLink } from "lucide-react"
import { cn } from "cn"

interface HashProps {
  value: string
  head?: number
  tail?: number
  href?: string
  className?: string
}

function truncate(value: string, head: number, tail: number) {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`
}

function Hash({ value, head = 10, tail = 6, href, className }: HashProps) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-xs text-foreground/80", className)}>
      <span title={value}>{truncate(value, head, tail)}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </button>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" aria-label="Open in explorer" className="rounded p-0.5 text-muted-foreground hover:text-foreground">
          <ExternalLink className="size-3" />
        </a>
      )}
    </span>
  )
}

export { Hash }
