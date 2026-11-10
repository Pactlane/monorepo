import { NETWORKS } from "@pactlane/core/network"

export const APP_NETWORK = NETWORKS.testnet

const ADDRESS_KEY = "@StellarWalletsKit/activeAddress"

export interface WalletSession {
  address: string
  networkPassphrase?: string
}

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

export function hasSavedSession() {
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

export async function connectWallet(): Promise<WalletSession> {
  const kit = await loadKit()
  const { address } = await kit.authModal()
  return { address, networkPassphrase: await walletNetwork(kit) }
}

export async function restoreWallet(): Promise<WalletSession | undefined> {
  if (!hasSavedSession()) return undefined
  const kit = await loadKit()
  try {
    const { address } = await kit.getAddress()
    return { address, networkPassphrase: await walletNetwork(kit) }
  } catch {
    return undefined
  }
}

export async function refreshNetwork(): Promise<string | undefined> {
  return walletNetwork(await loadKit())
}

export async function disconnectWallet() {
  const kit = await loadKit()
  await kit.disconnect()
}

export function walletErrorMessage(error: unknown): string | undefined {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message: unknown }).message)
      : undefined
  if (message && /clos|cancel|reject|denied/i.test(message)) return undefined
  return message ?? "Could not connect to the wallet"
}
