import { nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk"
import type { NetworkId } from "@pactlane/core/network"
import { contractError } from "@pactlane/stellar"
import { STELLAR_8004_REGISTRIES } from "./registries"
import type { ReadContract } from "./read"

const FEEDBACK_NOT_FOUND = 2

export interface RawFeedback {
  value: bigint
  valueDecimals: number
  isRevoked: boolean
  tag1: string
  tag2: string
}

export interface FeedbackEntry extends RawFeedback {
  agentIndex: number
  client: string
  index: number
  jobId: string
}

export type JobIdFromFeedback = (feedback: RawFeedback) => string | null

export const PACTLANE_JOB_TAG = "pactlane:job"

export const defaultJobIdFromFeedback: JobIdFromFeedback = (f) =>
  f.tag1 === PACTLANE_JOB_TAG && /^[1-9]\d*$/.test(f.tag2) ? f.tag2 : null

export interface FeedbackPage {
  entries: FeedbackEntry[]
  nextCursor: number | null
}

export class ReputationRegistryClient {
  readonly registryId: string
  readonly #read: ReadContract
  readonly #jobId: JobIdFromFeedback

  constructor(
    read: ReadContract,
    opts: {
      network?: NetworkId
      registryId?: string
      jobIdFromFeedback?: JobIdFromFeedback
    } = {}
  ) {
    this.#read = read
    this.registryId =
      opts.registryId ??
      STELLAR_8004_REGISTRIES[opts.network ?? "testnet"].reputation
    this.#jobId = opts.jobIdFromFeedback ?? defaultJobIdFromFeedback
  }

  async #feedback(
    agent: xdr.ScVal,
    client: string,
    index: number
  ): Promise<RawFeedback | null> {
    try {
      const raw = scValToNative(
        await this.#read(this.registryId, "read_feedback", [
          agent,
          nativeToScVal(client, { type: "address" }),
          nativeToScVal(BigInt(index), { type: "u64" }),
        ])
      ) as Record<string, unknown>
      return {
        value: BigInt(raw.value as bigint),
        valueDecimals: Number(raw.value_decimals),
        isRevoked: Boolean(raw.is_revoked),
        tag1: String(raw.tag1 ?? ""),
        tag2: String(raw.tag2 ?? ""),
      }
    } catch (error) {
      if (
        contractError(error instanceof Error ? error.message : "")?.code ===
        FEEDBACK_NOT_FOUND
      )
        return null
      throw error
    }
  }

  async listFeedback(
    agentIndex: number,
    { cursor = 0, limit = 10 }: { cursor?: number; limit?: number } = {}
  ): Promise<FeedbackPage> {
    if (!Number.isInteger(cursor) || cursor < 0)
      throw new RangeError("cursor must be a non-negative integer")
    if (!Number.isInteger(limit) || limit < 1)
      throw new RangeError("limit must be a positive integer")
    const agent = xdr.ScVal.scvU32(agentIndex)
    const clients = scValToNative(
      await this.#read(this.registryId, "get_clients_paginated", [
        agent,
        xdr.ScVal.scvU32(cursor),
        xdr.ScVal.scvU32(limit),
      ])
    ) as string[]
    const entries: FeedbackEntry[] = []
    for (const client of clients) {
      const last = Number(
        scValToNative(
          await this.#read(this.registryId, "get_last_index", [
            agent,
            nativeToScVal(client, { type: "address" }),
          ])
        )
      )
      for (let index = 1; index <= last; index++) {
        const feedback = await this.#feedback(agent, client, index)
        if (!feedback || feedback.isRevoked) continue
        const jobId = this.#jobId(feedback)
        if (jobId)
          entries.push({ ...feedback, agentIndex, client, index, jobId })
      }
    }
    return {
      entries,
      nextCursor: clients.length === limit ? cursor + limit : null,
    }
  }
}
