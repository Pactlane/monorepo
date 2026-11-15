import { describe, expect, test } from "bun:test"
import { Keypair, nativeToScVal, xdr, type rpc } from "@stellar/stellar-sdk"
import { addressToScVal, amountToScVal, hashToScVal } from "./scval"
import { decodeEvent } from "./events"

const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
const KERNEL = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
const b64 = (v: xdr.ScVal) => v.toXDR("base64")
const sym = (s: string) => b64(nativeToScVal(s, { type: "symbol" }))

function raw(
  over: Partial<rpc.Api.RawEventResponse>
): rpc.Api.RawEventResponse {
  return {
    id: "0024330766393540608-0000000003",
    type: "contract",
    ledger: 5664948,
    ledgerClosedAt: "2026-11-10T00:00:00Z",
    transactionIndex: 1,
    operationIndex: 0,
    txHash: "ab".repeat(32),
    contractId: XLM_SAC,
    topic: [],
    value: b64(xdr.ScVal.scvVoid()),
    ...over,
  }
}

const from = Keypair.random().publicKey()
const to = Keypair.random().publicKey()

describe("decodeEvent", () => {
  test("decodes a real testnet SAC fee event", () => {
    const event = decodeEvent(
      raw({
        id: "0024330766393540608-0000000001",
        txHash:
          "1a9fc687c48f3c4ef060e4eb4ba5f4032a99e48cadf350cd77104ed3fd74ea8b",
        topic: [
          "AAAADwAAAANmZWUA",
          "AAAAEgAAAAAAAAAAmeV7zEzNiZxNcA2culouVbhxfpKcgrougSv99d9rleI=",
        ],
        value: "AAAACgAAAAAAAAAAAAAAAAAAAGQ=",
      })
    )
    expect(event).toMatchObject({
      contractId: XLM_SAC,
      ledger: 5664948,
      eventIndex: 1,
      name: "fee",
      data: 100n,
    })
    expect(String(event?.topics[0])).toMatch(/^G[A-Z2-7]{55}$/)
  })

  test("decodes a hand-built SAC transfer", () => {
    const event = decodeEvent(
      raw({
        topic: [
          sym("transfer"),
          b64(addressToScVal(from)),
          b64(addressToScVal(to)),
        ],
        value: b64(amountToScVal(4_000_000n)),
      })
    )
    expect(event).toEqual({
      id: "0024330766393540608-0000000003",
      contractId: XLM_SAC,
      ledger: 5664948,
      txHash: "ab".repeat(32),
      eventIndex: 3,
      name: "transfer",
      topics: [from, to],
      data: 4_000_000n,
    })
  })

  test("decodes a kernel event when its name is known", () => {
    const spec = hashToScVal(`sha256:${"1".repeat(64)}`)
    const event = decodeEvent(
      raw({
        id: "0024330766393540608-0000000042",
        contractId: KERNEL,
        topic: [sym("job_funded"), b64(nativeToScVal(7n, { type: "u64" }))],
        value: b64(spec),
      }),
      ["job_funded"]
    )
    expect(event?.name).toBe("job_funded")
    expect(event?.eventIndex).toBe(42)
    expect(event?.topics).toEqual([7n])
    expect(event?.data).toBeInstanceOf(Uint8Array)
  })

  test("returns null for unknown names and malformed events", () => {
    expect(decodeEvent(raw({ topic: [sym("job_funded")] }))).toBeNull()
    expect(decodeEvent(raw({ topic: [] }))).toBeNull()
    expect(decodeEvent(raw({ topic: [b64(amountToScVal(1n))] }))).toBeNull()
    expect(decodeEvent(raw({ topic: ["not base64 xdr"] }))).toBeNull()
    expect(decodeEvent(raw({ id: "bad", topic: [sym("transfer")] }))).toBeNull()
  })
})
