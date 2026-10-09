import { describe, expect, test } from "bun:test"
import vectors from "../test-vectors/commitments.json"
import { canonicalize, commit, sha256Ref, type Domain } from "./canonical"

describe("canonicalize", () => {
  test("sorts keys, drops undefined, keeps array order", () => {
    expect(canonicalize({ b: 1, a: [true, null, "x"], c: { z: "1", y: undefined } })).toBe(
      '{"a":[true,null,"x"],"b":1,"c":{"z":"1"}}'
    )
  })

  test("is independent of key insertion order", () => {
    expect(canonicalize({ x: 1, y: 2 })).toBe(canonicalize({ y: 2, x: 1 }))
  })

  test("refuses bigint and non-finite numbers", () => {
    expect(() => canonicalize({ a: 1n })).toThrow(/bigint/)
    expect(() => canonicalize(Number.NaN)).toThrow()
  })
})

describe("commitment vectors", () => {
  for (const v of vectors) {
    test(v.name, () => {
      const actual =
        v.domain === null ? sha256Ref(v.input as string) : commit(v.domain as Domain, v.input)
      expect(actual).toBe(v.expected as `sha256:${string}`)
    })
  }

  test("domain separation changes the commitment", () => {
    const value = { a: 1 }
    expect(commit("pactlane.task.v1", value)).not.toBe(commit("pactlane.quote.v1", value))
  })
})
