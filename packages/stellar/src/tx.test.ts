import { describe, expect, test } from "bun:test"
import {
  Account,
  Address,
  Contract,
  Keypair,
  SorobanDataBuilder,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
  type Transaction,
} from "@stellar/stellar-sdk"
import { STELLAR_NETWORKS } from "@pactlane/config"
import { prepareInvoke, SimulationError, type InvokeRpc } from "./tx"

const TESTNET = STELLAR_NETWORKS.testnet.passphrase
const CONTRACT = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
const source = Keypair.random().publicKey()

const instanceKey = new Contract(CONTRACT).getFootprint()
const balanceKey = xdr.LedgerKey.contractData(
  new xdr.LedgerKeyContractData({
    contract: Address.fromString(CONTRACT).toScAddress(),
    key: nativeToScVal(["Balance", source], { type: ["symbol", "address"] }),
    durability: xdr.ContractDataDurability.persistent,
  })
)
const authEntry = new xdr.SorobanAuthorizationEntry({
  credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
  rootInvocation: new xdr.SorobanAuthorizedInvocation({
    function:
      xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: Address.fromString(CONTRACT).toScAddress(),
          functionName: "fund",
          args: [],
        })
      ),
    subInvocations: [],
  }),
})
const events = [{ raw: "diagnostic" }] as unknown as xdr.DiagnosticEvent[]

function success(): rpc.Api.SimulateTransactionSuccessResponse {
  return {
    id: "1",
    latestLedger: 100,
    events: [],
    _parsed: true,
    minResourceFee: "54321",
    transactionData: new SorobanDataBuilder()
      .setFootprint([instanceKey], [balanceKey])
      .setResources(1_000_000, 2_000, 3_000)
      .setResourceFee(54321n),
    result: { auth: [authEntry], retval: xdr.ScVal.scvVoid() },
  }
}

function fakeRpc(sim: rpc.Api.SimulateTransactionResponse) {
  const simulated: Transaction[] = []
  const accounts: string[] = []
  const fake: InvokeRpc = {
    async getAccount(address) {
      accounts.push(address)
      return new Account(address, "41")
    },
    async simulateTransaction(tx) {
      simulated.push(tx as Transaction)
      return sim
    },
  }
  return { fake, simulated, accounts }
}

const args = [nativeToScVal(4_000_000n, { type: "i128" })]

describe("prepareInvoke", () => {
  test("simulates then assembles an unsigned invocation", async () => {
    const { fake, simulated, accounts } = fakeRpc(success())
    const prepared = await prepareInvoke({
      rpc: fake,
      networkPassphrase: TESTNET,
      source,
      contractId: CONTRACT,
      method: "fund",
      args,
    })

    expect(accounts).toEqual([source])
    expect(simulated).toHaveLength(1)
    const op = simulated[0]!.operations[0]!
    expect(op.type).toBe("invokeHostFunction")

    const tx = TransactionBuilder.fromXDR(prepared.xdr, TESTNET) as Transaction
    expect(tx.signatures).toHaveLength(0)
    expect(tx.source).toBe(source)
    expect(tx.sequence).toBe("42")
    expect(tx.fee).toBe(String(100 + 54321))
    expect(tx.networkPassphrase).toBe(TESTNET)
    const assembled = tx.operations[0]
    if (assembled?.type !== "invokeHostFunction") throw new Error("bad op")
    expect(assembled.auth?.map((a) => a.toXDR("base64"))).toEqual([
      authEntry.toXDR("base64"),
    ])

    expect(prepared.minResourceFee).toBe(54321n)
    expect(prepared.footprint).toEqual({
      readOnly: [instanceKey.toXDR("base64")],
      readWrite: [balanceKey.toXDR("base64")],
    })
    expect(prepared.authEntries).toEqual([authEntry.toXDR("base64")])
  })

  test("uses a provided Account without fetching it", async () => {
    const { fake, accounts } = fakeRpc(success())
    const prepared = await prepareInvoke({
      rpc: fake,
      networkPassphrase: TESTNET,
      source: new Account(source, "7"),
      contractId: CONTRACT,
      method: "fund",
      baseFee: 1_000n,
      timeoutSeconds: 60,
    })
    expect(accounts).toHaveLength(0)
    const tx = TransactionBuilder.fromXDR(prepared.xdr, TESTNET) as Transaction
    expect(tx.sequence).toBe("8")
    expect(tx.fee).toBe(String(1_000 + 54321))
    const maxTime = Number(tx.timeBounds?.maxTime)
    expect(maxTime).toBeGreaterThan(0)
    expect(maxTime - Date.now() / 1000).toBeLessThanOrEqual(60)
  })

  test("maps a simulation error to SimulationError with raw events", async () => {
    const { fake } = fakeRpc({
      id: "1",
      latestLedger: 100,
      _parsed: true,
      error: "HostError: Error(Auth, InvalidAction)",
      events,
    })
    const error = await prepareInvoke({
      rpc: fake,
      networkPassphrase: TESTNET,
      source,
      contractId: CONTRACT,
      method: "fund",
    }).then(
      () => undefined,
      (e: unknown) => e
    )
    expect(error).toBeInstanceOf(SimulationError)
    const sim = error as SimulationError
    expect(sim.message).toBe("HostError: Error(Auth, InvalidAction)")
    expect(sim.events).toBe(events)
    expect(sim.restoreRequired).toBe(false)
  })

  test("flags simulations that need a restore", async () => {
    const restore: rpc.Api.SimulateTransactionRestoreResponse = {
      ...success(),
      result: { auth: [], retval: xdr.ScVal.scvVoid() },
      events,
      restorePreamble: {
        minResourceFee: "100",
        transactionData: new SorobanDataBuilder(),
      },
    }
    const { fake } = fakeRpc(restore)
    const error = await prepareInvoke({
      rpc: fake,
      networkPassphrase: TESTNET,
      source,
      contractId: CONTRACT,
      method: "fund",
    }).then(
      () => undefined,
      (e: unknown) => e
    )
    expect(error).toBeInstanceOf(SimulationError)
    expect((error as SimulationError).restoreRequired).toBe(true)
    expect((error as SimulationError).events).toBe(events)
  })
})
