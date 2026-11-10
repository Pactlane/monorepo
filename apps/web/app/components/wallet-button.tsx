import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, LoaderCircle, LogOut, Wallet } from "lucide-react"
import { Badge } from "@pactlane/ui/components/badge"
import { Button } from "@pactlane/ui/components/button"
import { Hash } from "@pactlane/ui/components/hash"
import { cn } from "@pactlane/ui/lib/utils"
import {
  APP_NETWORK,
  connectWallet,
  disconnectWallet,
  isWrongNetwork,
  refreshNetwork,
  restoreWallet,
  walletErrorMessage,
  type WalletSession,
} from "@/lib/wallet.client"

type Status = "idle" | "connecting" | "connected"

export function WalletButton({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status>("idle")
  const [session, setSession] = useState<WalletSession>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    restoreWallet()
      .then((restored) => {
        if (active && restored) {
          setSession(restored)
          setStatus("connected")
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (status !== "connected") return
    const onFocus = () => {
      refreshNetwork()
        .then((networkPassphrase) =>
          setSession((s) => (s ? { ...s, networkPassphrase } : s))
        )
        .catch(() => {})
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [status])

  const connect = useCallback(async () => {
    setError(undefined)
    setStatus("connecting")
    try {
      setSession(await connectWallet())
      setStatus("connected")
    } catch (e) {
      setError(walletErrorMessage(e))
      setStatus("idle")
    }
  }, [])

  const disconnect = useCallback(async () => {
    await disconnectWallet().catch(() => {})
    setSession(undefined)
    setStatus("idle")
  }, [])

  if (status === "connected" && session) {
    const wrong = isWrongNetwork(session.networkPassphrase)
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {wrong ? (
          <Badge
            variant="warning"
            role="alert"
            title={`Switch your wallet to ${APP_NETWORK.id} to use Pactlane`}
          >
            <AlertTriangle aria-hidden />
            Wrong network
          </Badge>
        ) : (
          <Badge variant="neutral">Testnet</Badge>
        )}
        <span className="inline-flex h-9 items-center rounded-lg border px-2.5">
          <Hash value={session.address} head={4} tail={4} />
        </span>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Disconnect wallet"
          title="Disconnect wallet"
          onClick={disconnect}
        >
          <LogOut />
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <Button
        variant="outline"
        size="lg"
        onClick={connect}
        disabled={status === "connecting"}
      >
        {status === "connecting" ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <Wallet data-icon="inline-start" />
        )}
        {status === "connecting" ? "Connecting" : "Connect wallet"}
      </Button>
      {error && (
        <p
          role="alert"
          className="max-w-56 text-right text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  )
}
