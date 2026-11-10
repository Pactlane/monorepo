import { Asset } from "@stellar/stellar-sdk"
import type { Env, StellarNetwork } from "@pactlane/config"

export const USDC_ISSUERS: Record<StellarNetwork, string> = {
  testnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  mainnet: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
}

export function sacContractId(
  code: string,
  issuer: string | undefined,
  networkPassphrase: string
): string {
  return new Asset(code, issuer).contractId(networkPassphrase)
}

export function assertUsdcContract(
  env: Pick<
    Env,
    "STELLAR_NETWORK" | "STELLAR_NETWORK_PASSPHRASE" | "USDC_ASSET_CONTRACT_ID"
  >,
  issuer: string = USDC_ISSUERS[env.STELLAR_NETWORK]
): string {
  const derived = sacContractId("USDC", issuer, env.STELLAR_NETWORK_PASSPHRASE)
  const configured = env.USDC_ASSET_CONTRACT_ID
  const source = `USDC:${issuer} on ${env.STELLAR_NETWORK}`
  if (!configured) {
    throw new Error(
      `USDC_ASSET_CONTRACT_ID is not set; expected ${derived} for ${source}`
    )
  }
  if (configured !== derived) {
    throw new Error(
      `USDC_ASSET_CONTRACT_ID mismatch: configured ${configured}, derived ${derived} from ${source}`
    )
  }
  return derived
}
