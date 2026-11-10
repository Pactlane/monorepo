import {
  Account,
  Asset,
  BASE_FEE,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk"
import type { StellarNetwork } from "@pactlane/config"
import { PACTLANE_TESTNET } from "./kernel"
import { USDC_ISSUERS } from "./asset"

export interface ClassicAsset {
  code: string
  issuer: string
}

export interface HorizonBalance {
  asset_type: string
  asset_code?: string
  asset_issuer?: string
}

export interface HorizonAccount {
  account_id?: string
  id?: string
  sequence: string
  balances: HorizonBalance[]
}

export function usdcAsset(network: StellarNetwork = "testnet"): ClassicAsset {
  return { code: "USDC", issuer: USDC_ISSUERS[network] }
}

export function hasTrustline(
  account: Pick<HorizonAccount, "balances">,
  asset: ClassicAsset
): boolean {
  return account.balances.some(
    (b) =>
      b.asset_type !== "native" &&
      b.asset_code === asset.code &&
      b.asset_issuer === asset.issuer
  )
}

export function buildUsdcTrustline({
  account,
  asset = usdcAsset(),
  networkPassphrase = PACTLANE_TESTNET.networkPassphrase,
  timeoutSeconds = 300,
}: {
  account: HorizonAccount
  asset?: ClassicAsset
  networkPassphrase?: string
  timeoutSeconds?: number
}): string {
  const id = account.account_id ?? account.id ?? ""
  if (!StrKey.isValidEd25519PublicKey(id)) {
    throw new Error(
      "Trustlines need a G... account; secret keys are never accepted"
    )
  }
  return new TransactionBuilder(new Account(id, account.sequence), {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.changeTrust({ asset: new Asset(asset.code, asset.issuer) })
    )
    .setTimeout(timeoutSeconds)
    .build()
    .toXDR()
}
