import { describe, expect, test } from "bun:test"
import type { rpc } from "@stellar/stellar-sdk"
import { loadEnv, STELLAR_NETWORKS } from "@pactlane/config"
import { createRpc, rpcConfigFromEnv, type RpcServerFactory } from "./rpc"

const TESTNET = STELLAR_NETWORKS.testnet.passphrase
const MAINNET = STELLAR_NETWORKS.mainnet.passphrase

function fakeFactory(passphrase: string | Error) {
  const calls: { url: string; options: rpc.Server.Options }[] = []
  let getNetworkCalls = 0
  const factory: RpcServerFactory = (url, options) => {
    calls.push({ url, options })
    const server = {
      async getNetwork(): Promise<rpc.Api.GetNetworkResponse> {
        getNetworkCalls++
        if (passphrase instanceof Error) throw passphrase
        return { passphrase, protocolVersion: "23" }
      },
    }
    return server as unknown as rpc.Server
  }
  return { factory, calls, getNetworkCalls: () => getNetworkCalls }
}

describe("createRpc", () => {
  test("returns the server when the network passphrase matches", async () => {
    const fake = fakeFactory(TESTNET)
    const server = await createRpc(
      {
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: TESTNET,
      },
      { createServer: fake.factory, timeoutMs: 5000 }
    )
    expect(server).toBeDefined()
    expect(fake.calls).toEqual([
      {
        url: "https://soroban-testnet.stellar.org",
        options: { allowHttp: false, timeout: 5000 },
      },
    ])
    expect(fake.getNetworkCalls()).toBe(1)
  })

  test("throws a descriptive error on a mismatched passphrase", async () => {
    const fake = fakeFactory(MAINNET)
    const attempt = createRpc(
      { rpcUrl: "https://rpc.example.org", networkPassphrase: TESTNET },
      { createServer: fake.factory }
    )
    await expect(attempt).rejects.toThrow(
      `Stellar RPC at rpc.example.org serves network "${MAINNET}" but "${TESTNET}" is configured`
    )
  })

  test.each(["http://localhost:8000/rpc", "http://127.0.0.1:8000"])(
    "allows http for local node %s",
    async (rpcUrl) => {
      const fake = fakeFactory(TESTNET)
      await createRpc(
        { rpcUrl, networkPassphrase: TESTNET },
        { createServer: fake.factory }
      )
      expect(fake.calls[0]?.options.allowHttp).toBe(true)
    }
  )

  test.each([
    ["http://rpc.example.org", /Refusing insecure http/],
    ["http://localhost.example.org", /Refusing insecure http/],
    ["ftp://rpc.example.org", /Unsupported Stellar RPC URL protocol/],
    ["not a url", /not a valid URL/],
    ["", /not configured/],
  ])("rejects %p before contacting the network", async (rpcUrl, error) => {
    const fake = fakeFactory(TESTNET)
    await expect(
      createRpc(
        { rpcUrl, networkPassphrase: TESTNET },
        { createServer: fake.factory }
      )
    ).rejects.toThrow(error)
    expect(fake.calls).toHaveLength(0)
  })

  test("wraps getNetwork failures with the RPC host", async () => {
    const cause = new Error("ECONNREFUSED")
    const fake = fakeFactory(cause)
    const attempt = createRpc(
      {
        rpcUrl: "https://rpc.example.org/path?key=secret",
        networkPassphrase: TESTNET,
      },
      { createServer: fake.factory }
    )
    const error = await attempt.then(
      () => undefined,
      (e: unknown) => e
    )
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe(
      "Cannot reach Stellar RPC at rpc.example.org"
    )
    expect((error as Error).cause).toBe(cause)
  })
})

describe("rpcConfigFromEnv", () => {
  test("maps loadEnv output", () => {
    expect(rpcConfigFromEnv(loadEnv({}))).toEqual({
      rpcUrl: STELLAR_NETWORKS.testnet.rpcUrl,
      networkPassphrase: TESTNET,
    })
  })
})
