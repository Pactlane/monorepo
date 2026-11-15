import { StrKey } from "@stellar/stellar-sdk"
import type { StellarNetwork } from "@pactlane/config"

export const FRIENDBOT_URL = "https://friendbot.stellar.org"

export type FundResult = "funded" | "already_funded"

export async function fundTestnetAccount(
  address: string,
  opts: { network?: StellarNetwork; fetch?: typeof fetch } = {}
): Promise<FundResult> {
  if ((opts.network ?? "testnet") !== "testnet") {
    throw new Error("Friendbot only funds testnet accounts")
  }
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new Error(`Friendbot needs a G... account address: ${address}`)
  }
  const doFetch = opts.fetch ?? fetch
  const res = await doFetch(
    `${FRIENDBOT_URL}/?addr=${encodeURIComponent(address)}`
  )
  if (res.ok) return "funded"
  const body = await res.text().catch(() => "")
  if (
    res.status === 400 &&
    /already funded|createAccountAlreadyExist/i.test(body)
  ) {
    return "already_funded"
  }
  throw new Error(`Friendbot failed with HTTP ${res.status}`)
}
