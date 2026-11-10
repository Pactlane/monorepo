import { contractError } from "./kernel"
import { SimulationError } from "./tx"

export type StellarErrorCode =
  | "tx_bad_auth"
  | "tx_bad_seq"
  | "tx_insufficient_fee"
  | "tx_insufficient_balance"
  | "tx_too_late"
  | "tx_no_account"
  | "tx_failed"
  | "contract_error"
  | "restore_required"
  | "simulation_failed"
  | "account_not_found"
  | "network"
  | "timeout"
  | "wallet_rejected"
  | "unknown"

export class StellarError extends Error {
  override readonly name = "StellarError"
  readonly code: StellarErrorCode
  readonly contractCode?: number
  readonly contractName?: string
  override readonly cause?: unknown

  constructor(
    code: StellarErrorCode,
    message: string,
    extra: {
      contractCode?: number
      contractName?: string
      cause?: unknown
    } = {}
  ) {
    super(message)
    this.code = code
    this.contractCode = extra.contractCode
    this.contractName = extra.contractName
    this.cause = extra.cause
  }
}

const TX_CODES: Record<string, StellarErrorCode> = {
  txBadAuth: "tx_bad_auth",
  txBadAuthExtra: "tx_bad_auth",
  txBadSeq: "tx_bad_seq",
  txInsufficientFee: "tx_insufficient_fee",
  txInsufficientBalance: "tx_insufficient_balance",
  txTooLate: "tx_too_late",
  txNoAccount: "tx_no_account",
  txFailed: "tx_failed",
}

const MESSAGE_RULES: [RegExp, StellarErrorCode][] = [
  [/\b(tx[A-Z][A-Za-z]+)\b/, "unknown"],
  [/Account not found/i, "account_not_found"],
  [/user (rejected|declined)|request rejected|cancel/i, "wallet_rejected"],
  [/timed? ?out|ETIMEDOUT|aborted/i, "timeout"],
  [
    /fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|Network Error|Cannot reach/i,
    "network",
  ],
]

function resultCode(value: unknown): string | undefined {
  const type = (value as { result?: { type?: unknown } } | null)?.result?.type
  return typeof type === "string" ? type : undefined
}

export function classifyError(error: unknown): StellarError {
  if (error instanceof StellarError) return error
  try {
    const txCode =
      resultCode(error) ??
      resultCode((error as { errorResult?: unknown } | null)?.errorResult)
    if (txCode && TX_CODES[txCode]) {
      return new StellarError(TX_CODES[txCode], txCode, { cause: error })
    }

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : ""

    const contract = contractError(message)
    if (contract) {
      return new StellarError(
        "contract_error",
        `Contract error ${contract.name}`,
        {
          contractCode: contract.code,
          contractName: contract.name,
          cause: error,
        }
      )
    }
    if (error instanceof SimulationError) {
      return new StellarError(
        error.restoreRequired ? "restore_required" : "simulation_failed",
        message.split("\n")[0] ?? message,
        { cause: error }
      )
    }
    for (const [pattern, code] of MESSAGE_RULES) {
      const m = pattern.exec(message)
      if (!m) continue
      const mapped = code === "unknown" ? TX_CODES[m[1]!] : code
      if (mapped) return new StellarError(mapped, message, { cause: error })
    }
    return new StellarError("unknown", message || "Unknown Stellar error", {
      cause: error,
    })
  } catch {
    return new StellarError("unknown", "Unknown Stellar error", {
      cause: error,
    })
  }
}
