import {
  BASE_FEE,
  Operation,
  TransactionBuilder,
  rpc,
  type Account,
  type xdr,
} from "@stellar/stellar-sdk"

export type InvokeRpc = Pick<rpc.Server, "getAccount" | "simulateTransaction">

export interface PrepareInvokeParams {
  rpc: InvokeRpc
  networkPassphrase: string
  source: string | Account
  contractId: string
  method: string
  args?: xdr.ScVal[]
  baseFee?: bigint
  timeoutSeconds?: number
}

export interface PreparedFootprint {
  readOnly: string[]
  readWrite: string[]
}

export interface PreparedInvoke {
  xdr: string
  minResourceFee: bigint
  footprint: PreparedFootprint
  authEntries: string[]
}

export class SimulationError extends Error {
  override readonly name = "SimulationError"
  readonly events: xdr.DiagnosticEvent[]
  readonly restoreRequired: boolean

  constructor(
    message: string,
    events: xdr.DiagnosticEvent[],
    restoreRequired = false
  ) {
    super(message)
    this.events = events
    this.restoreRequired = restoreRequired
  }
}

export const DEFAULT_TX_TIMEOUT_SECONDS = 300

export async function prepareInvoke(
  params: PrepareInvokeParams
): Promise<PreparedInvoke> {
  const { rpc: server, networkPassphrase, contractId, method } = params
  const source =
    typeof params.source === "string"
      ? await server.getAccount(params.source)
      : params.source

  const raw = new TransactionBuilder(source, {
    fee: (params.baseFee ?? BigInt(BASE_FEE)).toString(),
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: method,
        args: params.args ?? [],
      })
    )
    .setTimeout(params.timeoutSeconds ?? DEFAULT_TX_TIMEOUT_SECONDS)
    .build()

  const sim = await server.simulateTransaction(raw)
  if (rpc.Api.isSimulationError(sim)) {
    throw new SimulationError(sim.error, sim.events)
  }
  if (rpc.Api.isSimulationRestore(sim)) {
    throw new SimulationError(
      `${method} needs archived ledger entries restored before it can run`,
      sim.events,
      true
    )
  }

  const tx = rpc.assembleTransaction(raw, sim).build()
  const footprint = sim.transactionData.getFootprint()
  return {
    xdr: tx.toXDR(),
    minResourceFee: BigInt(sim.minResourceFee),
    footprint: {
      readOnly: footprint.readOnly.map((key) => key.toXDR("base64")),
      readWrite: footprint.readWrite.map((key) => key.toXDR("base64")),
    },
    authEntries: (sim.result?.auth ?? []).map((entry) => entry.toXDR("base64")),
  }
}
