import { useSyncExternalStore } from "react"

export type WalletStatus = "idle" | "connecting" | "connected"

export interface WalletState {
  status: WalletStatus
  address?: string
  networkPassphrase?: string
  error?: string
}

const IDLE: WalletState = { status: "idle" }

let state: WalletState = IDLE
const listeners = new Set<() => void>()

export function setWalletState(next: WalletState) {
  state = next
  for (const listener of listeners) listener()
}

export function getWalletState() {
  return state
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useWallet(): WalletState {
  return useSyncExternalStore(subscribe, getWalletState, () => IDLE)
}
