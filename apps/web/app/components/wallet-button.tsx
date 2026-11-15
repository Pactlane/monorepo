import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Wallet,
} from "lucide-react"
import { fromAtomic } from "@pactlane/core/money"
import { Badge } from "@pactlane/ui/components/badge"
import { Button, buttonVariants } from "@pactlane/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@pactlane/ui/components/popover"
import { cn } from "@pactlane/ui/lib/utils"
import { explorerAccountUrl, shortAddress } from "@/lib/format"
import { useWallet } from "@/lib/wallet-store"
import {
  APP_NETWORK,
  connectWallet,
  disconnectWallet,
  isWrongNetwork,
  refreshNetwork,
  restoreWallet,
} from "@/lib/wallet.client"

interface Balances {
  usdc: string | null
  xlm: string | null
}

function formatAmount(atomic: string, minFraction: number, maxFraction = 7) {
  const [whole, frac = ""] = fromAtomic(atomic).split(".")
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${grouped}.${frac.slice(0, maxFraction).padEnd(minFraction, "0")}`
}

function useBalances(address: string | undefined, open: boolean) {
  const [state, setState] = useState<{
    data?: Balances
    error?: string
    loading: boolean
  }>({ loading: false })

  const load = useCallback(async () => {
    if (!address) return
    setState((s) => ({ ...s, loading: true, error: undefined }))
    try {
      const res = await fetch(`/api/balance?address=${address}`)
      const json = (await res.json()) as Balances & { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Could not load balances")
      setState({ data: json, loading: false })
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Could not load balances",
      }))
    }
  }, [address])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  return { ...state, reload: load }
}

function Identicon({
  address,
  className,
}: {
  address: string
  className?: string
}) {
  let h = 0
  for (const c of address) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const a = h % 360
  const b = (a + 140) % 360
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 rounded-full ring-1 ring-foreground/10",
        className
      )}
      style={{
        background: `conic-gradient(from ${h % 90}deg, hsl(${a} 70% 55%), hsl(${b} 65% 50%), hsl(${a} 70% 55%))`,
      }}
    />
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      className="flex-1"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }}
    >
      {copied ? (
        <Check data-icon="inline-start" className="text-success" />
      ) : (
        <Copy data-icon="inline-start" />
      )}
      {copied ? "Copied" : "Copy address"}
    </Button>
  )
}

function WalletPanel({
  address,
  wrongNetwork,
  open,
  onDisconnect,
}: {
  address: string
  wrongNetwork: boolean
  open: boolean
  onDisconnect: () => void
}) {
  const balances = useBalances(address, open)
  const usdc = balances.data?.usdc
  const xlm = balances.data?.xlm

  return (
    <>
      <div className="flex items-center gap-3 border-b px-4 py-3.5">
        <Identicon address={address} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Connected wallet</p>
          <p className="truncate font-mono text-sm font-medium">
            {shortAddress(address)}
          </p>
        </div>
        {wrongNetwork ? (
          <Badge variant="warning">
            <AlertTriangle aria-hidden /> Wrong network
          </Badge>
        ) : (
          <Badge variant="success">Testnet</Badge>
        )}
      </div>

      {wrongNetwork && (
        <p
          role="alert"
          className="border-b bg-warning-soft px-4 py-2.5 text-xs text-warning"
        >
          Switch your wallet to Stellar {APP_NETWORK.id} to sign Pactlane
          transactions.
        </p>
      )}

      <div className="space-y-2.5 px-4 py-3.5">
        <p className="rounded-lg bg-muted/70 px-3 py-2 font-mono text-[11px] leading-relaxed break-all text-foreground/80">
          {address}
        </p>
        <div className="flex gap-2">
          <CopyButton value={address} />
          <a
            href={explorerAccountUrl("testnet", address)}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "flex-1",
            })}
          >
            <ExternalLink className="size-3.5" aria-hidden /> Explorer
          </a>
        </div>
      </div>

      <div className="border-t px-4 py-3.5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Balances</p>
          <button
            type="button"
            onClick={() => void balances.reload()}
            disabled={balances.loading}
            aria-label="Refresh balances"
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
          >
            <RefreshCw
              className={cn("size-3.5", balances.loading && "animate-spin")}
            />
          </button>
        </div>

        {balances.error ? (
          <p className="text-xs text-destructive">{balances.error}</p>
        ) : (
          <dl className="divide-y rounded-lg border">
            <div className="flex items-baseline justify-between px-3 py-2.5">
              <dt className="text-sm font-medium">USDC</dt>
              <dd className="font-mono text-base font-semibold tabular-nums">
                {balances.data === undefined ? (
                  <span className="inline-block h-4 w-20 animate-pulse rounded bg-muted align-middle" />
                ) : usdc === null ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    No trustline
                  </span>
                ) : (
                  formatAmount(usdc!, 2)
                )}
              </dd>
            </div>
            <div className="flex items-baseline justify-between px-3 py-2">
              <dt className="text-xs text-muted-foreground">XLM for fees</dt>
              <dd className="font-mono text-xs text-muted-foreground tabular-nums">
                {balances.data === undefined ? (
                  <span className="inline-block h-3 w-14 animate-pulse rounded bg-muted align-middle" />
                ) : xlm === null ? (
                  "0.00"
                ) : (
                  formatAmount(xlm!, 2, 2)
                )}
              </dd>
            </div>
          </dl>
        )}

        {balances.data && (usdc === null || usdc === "0") && (
          <p className="mt-2 text-xs text-muted-foreground">
            {usdc === null
              ? "Add a USDC trustline in your wallet, then get test USDC from "
              : "Get test USDC from "}
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Circle&apos;s faucet
            </a>
            .
          </p>
        )}
      </div>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:bg-danger-soft hover:text-destructive"
          onClick={onDisconnect}
        >
          <LogOut data-icon="inline-start" /> Disconnect
        </Button>
      </div>
    </>
  )
}

export function WalletButton({ className }: { className?: string }) {
  const wallet = useWallet()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    restoreWallet().catch(() => {})
  }, [])

  useEffect(() => {
    if (wallet.status !== "connected") return
    const onFocus = () => void refreshNetwork().catch(() => {})
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [wallet.status])

  if (wallet.status === "connected" && wallet.address) {
    const wrong = isWrongNetwork(wallet.networkPassphrase)
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg border bg-background py-1 pr-2 pl-1.5 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:bg-muted",
            className
          )}
          aria-label={`Wallet ${shortAddress(wallet.address)}${wrong ? ", wrong network" : ""}`}
        >
          <span className="relative">
            <Identicon address={wallet.address} className="size-6" />
            <span
              aria-hidden
              className={cn(
                "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-background",
                wrong ? "bg-warning" : "bg-success"
              )}
            />
          </span>
          <span className="font-mono text-xs">
            {shortAddress(wallet.address)}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </PopoverTrigger>
        <PopoverContent>
          <WalletPanel
            address={wallet.address}
            wrongNetwork={wrong}
            open={open}
            onDisconnect={() => {
              setOpen(false)
              void disconnectWallet().catch(() => {})
            }}
          />
        </PopoverContent>
      </Popover>
    )
  }

  const connecting = wallet.status === "connecting"
  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <Button
        variant="outline"
        size="lg"
        onClick={() => void connectWallet()}
        disabled={connecting}
      >
        {connecting ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <Wallet data-icon="inline-start" />
        )}
        {connecting ? "Connecting" : "Connect wallet"}
      </Button>
      {wallet.error && (
        <p
          role="alert"
          className="max-w-56 text-right text-xs text-destructive"
        >
          {wallet.error}
        </p>
      )}
    </div>
  )
}
