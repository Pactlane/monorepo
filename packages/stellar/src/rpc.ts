import { rpc } from "@stellar/stellar-sdk"
import type { Env } from "@pactlane/config"

export interface RpcConfig {
  rpcUrl: string
  networkPassphrase: string
}

export type RpcServerFactory = (
  url: string,
  options: rpc.Server.Options
) => rpc.Server

export interface CreateRpcOptions {
  timeoutMs?: number
  createServer?: RpcServerFactory
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"])

const defaultFactory: RpcServerFactory = (url, options) =>
  new rpc.Server(url, options)

export function rpcConfigFromEnv(
  env: Pick<Env, "STELLAR_RPC_URL" | "STELLAR_NETWORK_PASSPHRASE">
): RpcConfig {
  return {
    rpcUrl: env.STELLAR_RPC_URL,
    networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
  }
}

export function rpcServerOptions(rpcUrl: string): rpc.Server.Options {
  if (!rpcUrl) throw new Error("Stellar RPC URL is not configured")
  let url: URL
  try {
    url = new URL(rpcUrl)
  } catch {
    throw new Error("Stellar RPC URL is not a valid URL")
  }
  if (url.protocol === "https:") return { allowHttp: false }
  if (url.protocol === "http:") {
    if (LOCAL_HOSTS.has(url.hostname)) return { allowHttp: true }
    throw new Error(
      `Refusing insecure http:// Stellar RPC URL for ${url.hostname}; use https or a localhost node`
    )
  }
  throw new Error(`Unsupported Stellar RPC URL protocol ${url.protocol}`)
}

export async function createRpc(
  config: RpcConfig,
  options: CreateRpcOptions = {}
): Promise<rpc.Server> {
  const serverOptions = rpcServerOptions(config.rpcUrl)
  if (options.timeoutMs !== undefined) serverOptions.timeout = options.timeoutMs
  const host = new URL(config.rpcUrl).host
  const server = (options.createServer ?? defaultFactory)(
    config.rpcUrl,
    serverOptions
  )
  let network: rpc.Api.GetNetworkResponse
  try {
    network = await server.getNetwork()
  } catch (cause) {
    throw new Error(`Cannot reach Stellar RPC at ${host}`, { cause })
  }
  if (network.passphrase !== config.networkPassphrase) {
    throw new Error(
      `Stellar RPC at ${host} serves network "${network.passphrase}" but "${config.networkPassphrase}" is configured`
    )
  }
  return server
}
