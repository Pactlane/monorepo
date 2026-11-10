import { BASE_FEE, rpc } from "@stellar/stellar-sdk"
import { fromAtomic } from "@pactlane/core"

export interface FeeSummary {
  inclusionFee: bigint
  resourceFee: bigint
  totalStroops: bigint
  totalXlm: string
}

const STROOP_DECIMALS = 7

export function stroopsToXlm(stroops: bigint): string {
  const xlm = fromAtomic(stroops, STROOP_DECIMALS)
  const [whole, frac = ""] = xlm.split(".")
  return `${whole}.${frac.padEnd(STROOP_DECIMALS, "0")}`
}

export function summarizeFees(
  simulation: rpc.Api.SimulateTransactionResponse,
  inclusionFee: bigint = BigInt(BASE_FEE)
): FeeSummary {
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(
      `Cannot summarise fees of a failed simulation: ${simulation.error}`
    )
  }
  if (inclusionFee < 0n)
    throw new RangeError("Inclusion fee must not be negative")
  const resourceFee = BigInt(simulation.minResourceFee)
  const totalStroops = inclusionFee + resourceFee
  return {
    inclusionFee,
    resourceFee,
    totalStroops,
    totalXlm: stroopsToXlm(totalStroops),
  }
}
