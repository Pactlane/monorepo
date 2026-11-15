import { describe, expect, test } from "bun:test"
import {
  Keypair,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk"
import { parseAgentId } from "@pactlane/core/network"
import { SimulationError } from "@pactlane/stellar"
import { IdentityRegistryClient } from "./identity-registry"
import {
  ReputationRegistryClient,
  type RawFeedback,
} from "./reputation-registry"
import { STELLAR_8004_REGISTRIES } from "./registries"
import type { ReadContract } from "./read"

const contractErr = (n: number) =>
  new SimulationError(`HostError: Error(Contract, #${n})`, [])

describe("IdentityRegistryClient", () => {
  const owner = Keypair.random().publicKey()
  const agents: Record<number, { owner: string; uri?: string }> = {
    0: { owner, uri: "data:application/json;base64,e30=" },
    5: { owner },
  }
  const calls: string[] = []
  const read: ReadContract = async (contractId, method, args) => {
    calls.push(`${contractId}:${method}`)
    const i = Number(scValToNative(args[0]!))
    const a = agents[i]
    if (method === "find_owner")
      return a
        ? nativeToScVal(a.owner, { type: "address" })
        : xdr.ScVal.scvVoid()
    if (method === "agent_uri") {
      if (!a?.uri) throw contractErr(2)
      return nativeToScVal(a.uri)
    }
    throw new Error(`unexpected ${method}`)
  }
  const client = new IdentityRegistryClient(read)

  test("reads owner and metadata URI and builds a parseAgentId-compatible id", async () => {
    const agent = await client.getAgent(0)
    expect(agent).toEqual({
      id: `stellar:testnet:${STELLAR_8004_REGISTRIES.testnet.identity}#0`,
      index: 0,
      owner,
      metadataUri: "data:application/json;base64,e30=",
    })
    expect(parseAgentId(agent!.id)).toEqual({
      network: "testnet",
      registryId: STELLAR_8004_REGISTRIES.testnet.identity,
      index: 0n,
    })
    expect(
      calls.every((c) => c.startsWith(STELLAR_8004_REGISTRIES.testnet.identity))
    ).toBe(true)
  })

  test("an agent without a URI has metadataUri null", async () => {
    expect((await client.getAgent(5))?.metadataUri).toBeNull()
  })

  test("an unknown agent returns null", async () => {
    expect(await client.getAgent(999)).toBeNull()
  })

  test("rejects indexes outside u32", async () => {
    await expect(client.getAgent(-1)).rejects.toThrow(RangeError)
    await expect(client.getAgent(2 ** 32)).rejects.toThrow(RangeError)
  })
})

describe("ReputationRegistryClient", () => {
  const clients = Array.from({ length: 5 }, () => Keypair.random().publicKey())
  const fb = (
    tag1: string,
    tag2: string,
    isRevoked = false,
    value = 90n
  ): RawFeedback => ({
    value,
    valueDecimals: 0,
    isRevoked,
    tag1,
    tag2,
  })
  const store: Record<string, (RawFeedback | null)[]> = {
    [clients[0]!]: [fb("pactlane:job", "12"), fb("starred", "")],
    [clients[1]!]: [fb("pactlane:job", "13", true)],
    [clients[2]!]: [null, fb("pactlane:job", "14", false, 75n)],
    [clients[3]!]: [fb("pactlane:job", "not-a-number")],
    [clients[4]!]: [fb("pactlane:job", "15")],
  }
  const read: ReadContract = async (_c, method, args) => {
    const n = args.map((a) => scValToNative(a))
    if (method === "get_clients_paginated") {
      return nativeToScVal(
        clients.slice(Number(n[1]), Number(n[1]) + Number(n[2])),
        { type: ["address"] } as never
      )
    }
    if (method === "get_last_index")
      return nativeToScVal(BigInt(store[n[1] as string]!.length), {
        type: "u64",
      })
    if (method === "read_feedback") {
      const f = store[n[1] as string]![Number(n[2]) - 1]
      if (!f) throw contractErr(2)
      return nativeToScVal(
        {
          is_revoked: f.isRevoked,
          tag1: f.tag1,
          tag2: f.tag2,
          value: f.value,
          value_decimals: f.valueDecimals,
        },
        {
          type: {
            value: ["symbol", "i128"],
            value_decimals: ["symbol", "u32"],
          },
        } as never
      )
    }
    throw new Error(`unexpected ${method}`)
  }
  const rep = new ReputationRegistryClient(read)

  test("keeps only non-revoked entries tied to a job id", async () => {
    const page = await rep.listFeedback(2, { limit: 10 })
    expect(
      page.entries.map((e): unknown[] => [e.client, e.index, e.jobId, e.value])
    ).toEqual([
      [clients[0], 1, "12", 90n],
      [clients[2], 2, "14", 75n],
      [clients[4], 1, "15", 90n],
    ])
    expect(page.nextCursor).toBeNull()
  })

  test("paginates over clients with a cursor", async () => {
    const first = await rep.listFeedback(2, { limit: 2 })
    expect(first.entries.map((e) => e.jobId)).toEqual(["12"])
    expect(first.nextCursor).toBe(2)
    const second = await rep.listFeedback(2, { cursor: 2, limit: 2 })
    expect(second.entries.map((e) => e.jobId)).toEqual(["14"])
    const third = await rep.listFeedback(2, {
      cursor: second.nextCursor!,
      limit: 2,
    })
    expect(third.entries.map((e) => e.jobId)).toEqual(["15"])
    expect(third.nextCursor).toBeNull()
  })

  test("the job id rule is injectable", async () => {
    const custom = new ReputationRegistryClient(read, {
      jobIdFromFeedback: (f) => (f.tag1 === "starred" ? "x" : null),
    })
    expect((await custom.listFeedback(2)).entries.map((e) => e.jobId)).toEqual([
      "x",
    ])
  })
})
