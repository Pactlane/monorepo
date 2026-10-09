import { describe, expect, test } from "bun:test"
import { NETWORKS, sha256Ref } from "@pactlane/core"
import {
  BASE_TIME,
  COMMERCE_CONTRACT_ID,
  fixtureIdentity,
  judge,
  marketReportTask,
} from "@pactlane/test-utils"
import { evaluateDeliverable } from "./bundle"
import { evaluateContent } from "./rubric"

const filler = Array.from({ length: 40 }, (_, i) => `insight${i}`).join(" ")
const good = `# Summary\n${filler}\n## Landscape\n${filler}\n## Risks\n${filler}`
const scout = fixtureIdentity("scout")

const base = (content: string) => {
  const bytes = new TextEncoder().encode(content)
  return {
    task: marketReportTask,
    deliverableBytes: bytes,
    deliverableHash: sha256Ref(bytes),
    jobId: "job-0001",
    networkPassphrase: NETWORKS.testnet.passphrase,
    commerceContractId: COMMERCE_CONTRACT_ID,
    evaluatorAddress: judge.address,
    providerWallet: scout.address,
    evaluationDeadlineUnix: BASE_TIME + 100,
    nowUnix: BASE_TIME,
  }
}

describe("rubric", () => {
  test("pass", () =>
    expect(evaluateContent(marketReportTask, good).verdict).toBe("pass"))
  test("fail on missing section", () => {
    const res = evaluateContent(
      marketReportTask,
      good.replace("## Risks", "## Other")
    )
    expect(res.verdict).toBe("fail")
    expect(
      res.checks.find((c) => c.kind === "required_sections")?.detail
    ).toContain("Risks")
  })
  test("needs_review on empty output", () =>
    expect(evaluateContent(marketReportTask, "  ").verdict).toBe(
      "needs_review"
    ))
})

describe("evaluateDeliverable", () => {
  test("binds verdict to job, task and deliverable", () => {
    const { bundle, bundleHash } = evaluateDeliverable(base(good))
    expect(bundle.verdict).toBe("pass")
    expect(bundle.jobId).toBe("job-0001")
    expect(bundleHash).toMatch(/^sha256:/)
  })

  test("rejects corrupted bytes", () => {
    const input = base(good)
    input.deliverableBytes = new TextEncoder().encode(good + "x")
    expect(() => evaluateDeliverable(input)).toThrow(/commitment/)
  })

  test("rejects provider self-evaluation and late evaluation", () => {
    expect(() =>
      evaluateDeliverable({ ...base(good), evaluatorAddress: scout.address })
    ).toThrow(/provider/)
    expect(() =>
      evaluateDeliverable({ ...base(good), nowUnix: BASE_TIME + 101 })
    ).toThrow(/deadline/)
  })
})
