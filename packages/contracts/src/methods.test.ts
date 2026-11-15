import { describe, expect, test } from "bun:test"
import { Keypair } from "@stellar/stellar-sdk"
import { kernelArgs, type KernelCall } from "@pactlane/stellar"
import {
  COMMERCE_METHODS,
  COMMERCE_WRITE_METHODS,
  EVALUATION_POLICY_METHODS,
} from "./methods"

describe("COMMERCE_METHODS", () => {
  test("names every public kernel function in pactlane-protocol at the pinned deployment", () => {
    expect(Object.keys(COMMERCE_METHODS).sort()).toEqual(
      [
        "admin",
        "claim_refund",
        "complete",
        "create_job",
        "extend_ttl",
        "fund",
        "get_job",
        "get_jobs",
        "job_count",
        "reject",
        "set_budget",
        "set_provider",
        "submit",
        "token",
        "upgrade",
      ].sort()
    )
  })

  test("keys equal values, so constants are the on-chain names", () => {
    for (const [k, v] of Object.entries({
      ...COMMERCE_METHODS,
      ...EVALUATION_POLICY_METHODS,
    })) {
      expect<string>(v).toBe(k)
    }
  })

  test("every write method is one @pactlane/stellar can encode", () => {
    const a = Keypair.random().publicKey()
    const b = Keypair.random().publicKey()
    const hash = `sha256:${"ab".repeat(32)}`
    const samples: Record<(typeof COMMERCE_WRITE_METHODS)[number], KernelCall> =
      {
        create_job: {
          method: "create_job",
          client: a,
          evaluator: b,
          expiresAt: 1_900_000_000,
          specHash: hash,
        },
        set_provider: { method: "set_provider", id: 1n, provider: b },
        set_budget: { method: "set_budget", id: 1n, actor: a, amount: 1n },
        fund: { method: "fund", id: 1n, expectedBudget: 1n },
        submit: { method: "submit", id: 1n, workHash: hash },
        complete: { method: "complete", id: 1n, reason: hash },
        reject: { method: "reject", id: 1n },
        claim_refund: { method: "claim_refund", id: 1n },
      }
    for (const method of COMMERCE_WRITE_METHODS) {
      expect(samples[method].method).toBe(method)
      expect(kernelArgs(samples[method]).length).toBeGreaterThan(0)
    }
  })
})
