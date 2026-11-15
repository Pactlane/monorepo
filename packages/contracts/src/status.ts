import { JOB_STATUSES, type JobStatus } from "@pactlane/core/job"

export const CHAIN_JOB_STATES: Readonly<Record<number, JobStatus>> =
  Object.freeze(
    Object.fromEntries(JOB_STATUSES.map((status, index) => [index, status]))
  )

export function fromChainStatus(value: unknown): JobStatus {
  const n =
    typeof value === "bigint"
      ? Number(value)
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : value
  if (typeof n === "number" && Number.isInteger(n) && n in CHAIN_JOB_STATES) {
    return CHAIN_JOB_STATES[n]!
  }
  throw new RangeError(`Unknown on-chain job state: ${String(value)}`)
}

export function toChainStatus(status: JobStatus): number {
  const index = JOB_STATUSES.indexOf(status)
  if (index < 0) throw new RangeError(`Unknown job status: ${status}`)
  return index
}
