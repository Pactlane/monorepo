import {
  commit,
  evaluationBundleSchema,
  sha256Ref,
  type EvaluationBundle,
  type Sha256Ref,
  type TaskSpec,
} from "@pactlane/core"
import { evaluateContent } from "./rubric"

export interface EvaluateInput {
  task: TaskSpec
  deliverableBytes: Uint8Array
  deliverableHash: Sha256Ref
  jobId: string
  networkPassphrase: string
  commerceContractId: string
  evaluatorAddress: string
  providerWallet: string
  evaluationDeadlineUnix: number
  nowUnix: number
}

export class EvaluationError extends Error {}

export function evaluateDeliverable(input: EvaluateInput): { bundle: EvaluationBundle; bundleHash: Sha256Ref } {
  if (input.evaluatorAddress === input.providerWallet) throw new EvaluationError("evaluator cannot be the provider")
  if (input.nowUnix > input.evaluationDeadlineUnix) throw new EvaluationError("evaluation deadline passed")
  if (sha256Ref(input.deliverableBytes) !== input.deliverableHash) {
    throw new EvaluationError("deliverable bytes do not match the submitted commitment")
  }
  const content = new TextDecoder().decode(input.deliverableBytes)
  const { verdict, checks } = evaluateContent(input.task, content)
  const bundle = evaluationBundleSchema.parse({
    schemaVersion: "pactlane.evaluation.v1",
    networkPassphrase: input.networkPassphrase,
    commerceContractId: input.commerceContractId,
    jobId: input.jobId,
    rubricId: input.task.rubricId,
    taskSpecHash: commit("pactlane.task.v1", input.task),
    deliverableHash: input.deliverableHash,
    verdict,
    checks,
    evaluatorAddress: input.evaluatorAddress,
    evaluationDeadlineUnix: input.evaluationDeadlineUnix,
    evaluatedAtUnix: input.nowUnix,
  })
  return { bundle, bundleHash: commit("pactlane.evaluation.v1", bundle) }
}
