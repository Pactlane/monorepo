import { describe, expect, test } from "bun:test"
import { Keypair } from "@stellar/stellar-sdk"
import { fundTestnetAccount } from "./friendbot"

const address = Keypair.random().publicKey()

function fakeFetch(status: number, body = "") {
  const urls: string[] = []
  const fn = (async (url: string) => {
    urls.push(url)
    return new Response(body, { status })
  }) as unknown as typeof fetch
  return { fn, urls }
}

describe("fundTestnetAccount", () => {
  test("funds a new account", async () => {
    const f = fakeFetch(200, "{}")
    expect(await fundTestnetAccount(address, { fetch: f.fn })).toBe("funded")
    expect(f.urls).toEqual([`https://friendbot.stellar.org/?addr=${address}`])
  })

  test("treats an already funded account as success", async () => {
    const body = JSON.stringify({
      status: 400,
      detail: "account already funded to starting balance",
    })
    const f = fakeFetch(400, body)
    expect(await fundTestnetAccount(address, { fetch: f.fn })).toBe(
      "already_funded"
    )
  })

  test("throws on other failures", async () => {
    await expect(
      fundTestnetAccount(address, { fetch: fakeFetch(500).fn })
    ).rejects.toThrow("HTTP 500")
    await expect(
      fundTestnetAccount(address, { fetch: fakeFetch(400, "bad address").fn })
    ).rejects.toThrow("HTTP 400")
  })

  test("refuses mainnet and bad addresses before any request", async () => {
    const f = fakeFetch(200)
    await expect(
      fundTestnetAccount(address, { network: "mainnet", fetch: f.fn })
    ).rejects.toThrow("only funds testnet")
    await expect(fundTestnetAccount("CABC", { fetch: f.fn })).rejects.toThrow(
      "G... account"
    )
    expect(f.urls).toHaveLength(0)
  })
})
