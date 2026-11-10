import { useEffect } from "react"
import { AlertTriangle, LoaderCircle, LogOut, Wallet } from "lucide-react"
import { Badge } from "@pactlane/ui/components/badge"
import { Button } from "@pactlane/ui/components/button"
import { Hash } from "@pactlane/ui/components/hash"
import { cn } from "@pactlane/ui/lib/utils"
import { useWallet } from "@/lib/wallet-store"
import {
  APP_NETWORK,
  connectWallet,
  disconnectWallet,
  isWrongNetwork,
  refreshNetwork,
  restoreWallet,
} from "@/lib/wallet.client"

export function WalletButton({ className }: { className?: string }) {
  const wallet = useWallet()

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
          <Hash value={wallet.address} head={4} tail={4} />
        </span>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Disconnect wallet"
          title="Disconnect wallet"
          onClick={() => void disconnectWallet().catch(() => {})}
        >
          <LogOut />
        </Button>
      </div>
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
