import { NETWORKS } from "@pactlane/core/network"
import { getWalletState, setWalletState } from "./wallet-store"

export const APP_NETWORK = NETWORKS.testnet

const ADDRESS_KEY = "@StellarWalletsKit/activeAddress"

type Kit = typeof import("@creit.tech/stellar-wallets-kit").StellarWalletsKit

let kitPromise: Promise<Kit> | undefined

function loadKit(): Promise<Kit> {
  kitPromise ??= (async () => {
    const [{ StellarWalletsKit, Networks }, { defaultModules }] =
      await Promise.all([
        import("@creit.tech/stellar-wallets-kit"),
        import("@creit.tech/stellar-wallets-kit/modules/utils"),
      ])
    StellarWalletsKit.init({
      modules: defaultModules(),
      network: Networks.TESTNET,
    })
    return StellarWalletsKit
  })()
  kitPromise.catch(() => (kitPromise = undefined))
  return kitPromise
}

export function isWrongNetwork(networkPassphrase: string | undefined) {
  return (
    networkPassphrase !== undefined &&
    networkPassphrase !== APP_NETWORK.passphrase
  )
}

function hasSavedSession() {
  try {
    return Boolean(globalThis.localStorage?.getItem(ADDRESS_KEY))
  } catch {
    return false
  }
}

async function walletNetwork(kit: Kit) {
  try {
    return (await kit.getNetwork()).networkPassphrase
  } catch {
    return undefined
  }
}

export function walletErrorMessage(error: unknown): string | undefined {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message: unknown }).message)
      : undefined
  if (message && /clos|cancel|reject|denied/i.test(message)) return undefined
  return message ?? "Could not connect to the wallet"
}

export async function connectWallet() {
  setWalletState({ status: "connecting" })
  try {
    const kit = await loadKit()
    const { address } = await kit.authModal()
    setWalletState({
      status: "connected",
      address,
      networkPassphrase: await walletNetwork(kit),
    })
  } catch (error) {
    setWalletState({ status: "idle", error: walletErrorMessage(error) })
  }
}

export async function restoreWallet() {
  if (!hasSavedSession() || getWalletState().status !== "idle") return
  try {
    const kit = await loadKit()
    const { address } = await kit.getAddress()
    setWalletState({
      status: "connected",
      address,
      networkPassphrase: await walletNetwork(kit),
    })
  } catch {
    setWalletState({ status: "idle" })
  }
}

export async function refreshNetwork() {
  const current = getWalletState()
  if (current.status !== "connected") return
  const networkPassphrase = await walletNetwork(await loadKit())
  setWalletState({ ...getWalletState(), networkPassphrase })
}

export async function disconnectWallet() {
  try {
    await (await loadKit()).disconnect()
  } finally {
    setWalletState({ status: "idle" })
  }
}

export async function signWithWallet(xdr: string): Promise<string> {
  const { address, status } = getWalletState()
  if (status !== "connected" || !address) {
    throw new Error("Connect a wallet first")
  }
  const kit = await loadKit()
  const { signedTxXdr } = await kit.signTransaction(xdr, {
    address,
    networkPassphrase: APP_NETWORK.passphrase,
  })
  return signedTxXdr
}
