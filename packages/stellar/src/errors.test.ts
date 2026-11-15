import { describe, expect, test } from "bun:test"
import type { xdr } from "@stellar/stellar-sdk"
import { classifyError, StellarError, type StellarErrorCode } from "./errors"
import { SimulationError } from "./tx"

const txResult = (type: string) =>
  ({ feeCharged: 100n, result: { type } }) as unknown as xdr.TransactionResult

describe("classifyError", () => {
  test.each<[string, unknown, StellarErrorCode]>([
    ["tx result object", txResult("txBadAuth"), "tx_bad_auth"],
    [
      "rejected submit result",
      { status: "rejected", errorResult: txResult("txBadSeq") },
      "tx_bad_seq",
    ],
    [
      "insufficient fee message",
      new Error("transaction failed: txInsufficientFee"),
      "tx_insufficient_fee",
    ],
    ["too late", txResult("txTooLate"), "tx_too_late"],
    [
      "contract error",
      new SimulationError("HostError: Error(Contract, #8)", []),
      "contract_error",
    ],
    [
      "restore",
      new SimulationError("needs restore", [], true),
      "restore_required",
    ],
    [
      "simulation",
      new SimulationError("HostError: Error(Auth, InvalidAction)", []),
      "simulation_failed",
    ],
    [
      "missing account",
      new Error("Account not found: GABC"),
      "account_not_found",
    ],
    ["wallet", new Error("User rejected the request"), "wallet_rejected"],
    ["network", new TypeError("fetch failed"), "network"],
    ["unreachable rpc", new Error("Cannot reach Stellar RPC at x"), "network"],
    ["timeout", new Error("Request timed out"), "timeout"],
    ["plain string", "txNoAccount", "tx_no_account"],
    ["unknown tx code", txResult("txMalformed"), "unknown"],
    ["unknown error", new Error("boom"), "unknown"],
    ["null", null, "unknown"],
    ["number", 42, "unknown"],
    ["object", { weird: true }, "unknown"],
  ])("%s", (_label, input, code) => {
    const error = classifyError(input)
    expect(error).toBeInstanceOf(StellarError)
    expect(error.code).toBe(code)
  })

  test("keeps the contract code and name", () => {
    const error = classifyError(new SimulationError("Error(Contract, #8)", []))
    expect(error.contractCode).toBe(8)
    expect(error.contractName).toBe("BudgetMismatch")
  })

  test("passes StellarError through and never throws on hostile input", () => {
    const original = new StellarError("timeout", "slow")
    expect(classifyError(original)).toBe(original)
    const hostile = new Proxy(
      {},
      {
        get: () => {
          throw new Error("trap")
        },
      }
    )
    expect(classifyError(hostile).code).toBe("unknown")
  })
})
