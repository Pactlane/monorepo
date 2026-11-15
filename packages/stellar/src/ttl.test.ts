import { describe, expect, test } from "bun:test"
import {
  Account,
  Contract,
  Keypair,
  SorobanDataBuilder,
  TransactionBuilder,
  rpc,
  xdr,
  type Transaction,
} from "@stellar/stellar-sdk"
import { STELLAR_NETWORKS } from "@pactlane/config"
import { PACTLANE_TESTNET } from "./kernel"
import { buildExtendTtl, buildRestore, getEntryTtl, MAX_EXTEND_TO } from "./ttl"

const TESTNET = STELLAR_NETWORKS.testnet.passphrase
const key = new Contract(PACTLANE_TESTNET.kernel).getFootprint()
const other = new Contract(PACTLANE_TESTNET.token).getFootprint()
const source = () => new Account(Keypair.random().publicKey(), "10")

function footprintOf(xdrText: string) {
  const tx = TransactionBuilder.fromXDR(xdrText, TESTNET) as Transaction
  const data = tx.toEnvelope() as unknown as {
    value: { tx: { ext: { value: xdr.SorobanTransactionData } } }
  }
  const fp = new SorobanDataBuilder(data.value.tx.ext.value).getFootprint()
  return {
    tx,
    readOnly: fp.readOnly.map((k) => k.toXDR("base64")),
    readWrite: fp.readWrite.map((k) => k.toXDR("base64")),
  }
}

describe("getEntryTtl", () => {
  test("returns liveUntilLedgerSeq for the requested key", async () => {
    const fake = {
      async getLedgerEntries(...keys: xdr.LedgerKey[]) {
        expect(keys).toHaveLength(1)
        return {
          latestLedger: 100,
          entries: [
            {
              key: other,
              val: {} as xdr.LedgerEntryData,
              liveUntilLedgerSeq: 1,
            },
            {
              key,
              val: {} as xdr.LedgerEntryData,
              liveUntilLedgerSeq: 3_200_000,
            },
          ],
        } as rpc.Api.GetLedgerEntriesResponse
      },
    }
    expect(await getEntryTtl(fake, key)).toBe(3_200_000)
  })

  test("returns null for missing or archived entries", async () => {
    const fake = {
      async getLedgerEntries() {
        return {
          latestLedger: 100,
          entries: [],
        } as rpc.Api.GetLedgerEntriesResponse
      },
    }
    expect(await getEntryTtl(fake, key)).toBeNull()
  })
})

describe("buildExtendTtl", () => {
  test("builds an unsigned extend op over a read-only footprint", async () => {
    const { tx, readOnly, readWrite } = footprintOf(
      await buildExtendTtl({
        source: source(),
        keys: [key, other],
        extendTo: 1000,
      })
    )
    expect(tx.signatures).toHaveLength(0)
    const op = tx.operations[0] as { type: string; extendTo: number }
    expect(op.type).toBe("extendFootprintTtl")
    expect(op.extendTo).toBe(1000)
    expect(readOnly).toEqual([key.toXDR("base64"), other.toXDR("base64")])
    expect(readWrite).toEqual([])
  })

  test("defaults to the network maximum and validates input", async () => {
    const { tx } = footprintOf(
      await buildExtendTtl({ source: source(), keys: [key] })
    )
    expect((tx.operations[0] as { extendTo: number }).extendTo).toBe(
      MAX_EXTEND_TO
    )
    expect(MAX_EXTEND_TO).toBe(3_110_399)
    for (const extendTo of [0, 1.5, 3_110_400]) {
      expect(() =>
        buildExtendTtl({ source: source(), keys: [key], extendTo })
      ).toThrow(RangeError)
    }
    await expect(
      buildExtendTtl({ source: source(), keys: [] })
    ).rejects.toThrow("At least one")
  })

  test("simulates and assembles when an rpc is given", async () => {
    const fake = {
      async simulateTransaction() {
        return {
          id: "1",
          latestLedger: 1,
          _parsed: true,
          events: [],
          minResourceFee: "777",
          transactionData: new SorobanDataBuilder()
            .setReadOnly([key])
            .setResourceFee(777n),
        } as rpc.Api.SimulateTransactionSuccessResponse
      },
    }
    const { tx } = footprintOf(
      await buildExtendTtl({ source: source(), keys: [key], rpc: fake })
    )
    expect(tx.fee).toBe(String(100 + 777))
  })
})

describe("buildRestore", () => {
  test("builds an unsigned restore op over a read-write footprint", async () => {
    const { tx, readOnly, readWrite } = footprintOf(
      await buildRestore({ source: source(), keys: [key] })
    )
    expect(tx.signatures).toHaveLength(0)
    expect(tx.operations[0]?.type).toBe("restoreFootprint")
    expect(readOnly).toEqual([])
    expect(readWrite).toEqual([key.toXDR("base64")])
  })
})
