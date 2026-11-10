import { describe, expect, test } from "bun:test"
import {
  Keypair,
  TransactionBuilder,
  type Transaction,
} from "@stellar/stellar-sdk"
import { STELLAR_NETWORKS } from "@pactlane/config"
import account from "./fixtures/horizon-account-usdc.json"
import { buildUsdcTrustline, hasTrustline, usdcAsset } from "./trustline"

const TESTNET = STELLAR_NETWORKS.testnet.passphrase
const withoutUsdc = {
  ...account,
  balances: account.balances.filter((b) => b.asset_type === "native"),
}

describe("hasTrustline", () => {
  test("detects the USDC trustline in a Horizon account", () => {
    expect(hasTrustline(account, usdcAsset())).toBe(true)
    expect(hasTrustline(withoutUsdc, usdcAsset())).toBe(false)
  })

  test("matches on both code and issuer", () => {
    expect(hasTrustline(account, usdcAsset("mainnet"))).toBe(false)
    expect(
      hasTrustline(account, { code: "EURC", issuer: usdcAsset().issuer })
    ).toBe(false)
  })
})

describe("buildUsdcTrustline", () => {
  test("returns an unsigned changeTrust transaction for the next sequence", () => {
    const xdr = buildUsdcTrustline({ account: withoutUsdc })
    const tx = TransactionBuilder.fromXDR(xdr, TESTNET) as Transaction
    expect(tx.signatures).toHaveLength(0)
    expect(tx.source).toBe(account.account_id)
    expect(tx.sequence).toBe((BigInt(account.sequence) + 1n).toString())
    const op = tx.operations[0]
    expect(op?.type).toBe("changeTrust")
    if (op?.type !== "changeTrust") throw new Error("unreachable")
    const line = op.line as { code: string; issuer: string }
    expect(line.code).toBe("USDC")
    expect(line.issuer).toBe(usdcAsset().issuer)
  })

  test("refuses secret keys and malformed account ids", () => {
    const secret = Keypair.random().secret()
    expect(() =>
      buildUsdcTrustline({
        account: { ...withoutUsdc, account_id: secret, id: secret },
      })
    ).toThrow("secret keys are never accepted")
  })
})
