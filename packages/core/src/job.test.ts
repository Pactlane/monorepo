import { describe, expect, test } from "bun:test"
import {
  InvalidTransitionError,
  canTransition,
  isTerminal,
  nextStatus,
} from "./job"

describe("job state machine", () => {
  test("happy path", () => {
    let s = nextStatus("open", "fund")
    s = nextStatus(s, "submit")
    s = nextStatus(s, "complete")
    expect(s).toBe("completed")
    expect(isTerminal(s)).toBe(true)
  })

  test("refund paths", () => {
    expect(nextStatus("funded", "reject")).toBe("rejected")
    expect(nextStatus("submitted", "expire")).toBe("expired")
    expect(nextStatus("open", "cancel")).toBe("rejected")
  })

  test("terminal jobs cannot move", () => {
    for (const s of ["completed", "rejected", "expired"] as const) {
      expect(canTransition(s, "fund")).toBe(false)
      expect(canTransition(s, "complete")).toBe(false)
    }
    expect(() => nextStatus("completed", "complete")).toThrow(
      InvalidTransitionError
    )
  })

  test("cannot complete before submission", () => {
    expect(canTransition("funded", "complete")).toBe(false)
    expect(canTransition("open", "submit")).toBe(false)
  })
})
