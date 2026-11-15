import { scValToNative, xdr } from "@stellar/stellar-sdk"
import { formatAgentId, type NetworkId } from "@pactlane/core/network"
import { contractError } from "@pactlane/stellar"
import { STELLAR_8004_REGISTRIES } from "./registries"
import type { ReadContract } from "./read"

const URI_NOT_SET = 2
const U32_MAX = 2 ** 32 - 1

export interface RegistryAgent {
  id: string
  index: number
  owner: string
  metadataUri: string | null
  metadataHash?: string
}

export class IdentityRegistryClient {
  readonly registryId: string
  readonly network: NetworkId
  readonly #read: ReadContract

  constructor(
    read: ReadContract,
    opts: { network?: NetworkId; registryId?: string } = {}
  ) {
    this.#read = read
    this.network = opts.network ?? "testnet"
    this.registryId =
      opts.registryId ?? STELLAR_8004_REGISTRIES[this.network].identity
  }

  async totalAgents(): Promise<number> {
    return Number(
      scValToNative(await this.#read(this.registryId, "total_agents", []))
    )
  }

  async getAgent(index: number): Promise<RegistryAgent | null> {
    if (!Number.isInteger(index) || index < 0 || index > U32_MAX) {
      throw new RangeError(`Agent index must be a u32, got ${index}`)
    }
    const arg = [xdr.ScVal.scvU32(index)]
    const owner = scValToNative(
      await this.#read(this.registryId, "find_owner", arg)
    )
    if (owner === null || owner === undefined) return null
    let metadataUri: string | null = null
    try {
      metadataUri = String(
        scValToNative(await this.#read(this.registryId, "agent_uri", arg))
      )
    } catch (error) {
      if (
        contractError(error instanceof Error ? error.message : "")?.code !==
        URI_NOT_SET
      )
        throw error
    }
    return {
      id: formatAgentId({
        network: this.network,
        registryId: this.registryId,
        index: BigInt(index),
      }),
      index,
      owner: String(owner),
      metadataUri,
    }
  }
}
