import {
  BASE_FEE,
  Operation,
  SorobanDataBuilder,
  TransactionBuilder,
  rpc,
  type Account,
  type Transaction,
  type xdr,
} from "@stellar/stellar-sdk"
import { PACTLANE_TESTNET } from "./kernel"
import { SimulationError } from "./tx"

export const MAX_ENTRY_TTL_LEDGERS = 3_110_400
export const MAX_EXTEND_TO = MAX_ENTRY_TTL_LEDGERS - 1

export async function getEntryTtl(
  server: Pick<rpc.Server, "getLedgerEntries">,
  key: xdr.LedgerKey
): Promise<number | null> {
  const { entries } = await server.getLedgerEntries(key)
  const wanted = key.toXDR("base64")
  const entry = entries.find((e) => e.key.toXDR("base64") === wanted)
  return entry?.liveUntilLedgerSeq ?? null
}

interface FootprintTxOptions {
  source: Account
  keys: xdr.LedgerKey[]
  networkPassphrase?: string
  baseFee?: bigint
  timeoutSeconds?: number
  rpc?: Pick<rpc.Server, "simulateTransaction">
}

async function footprintTx(
  opts: FootprintTxOptions,
  operation: xdr.Operation,
  footprint: SorobanDataBuilder
): Promise<string> {
  if (opts.keys.length === 0)
    throw new Error("At least one ledger key is required")
  const raw = new TransactionBuilder(opts.source, {
    fee: (opts.baseFee ?? BigInt(BASE_FEE)).toString(),
    networkPassphrase:
      opts.networkPassphrase ?? PACTLANE_TESTNET.networkPassphrase,
  })
    .setSorobanData(footprint.build())
    .addOperation(operation)
    .setTimeout(opts.timeoutSeconds ?? 300)
    .build()
  if (!opts.rpc) return raw.toXDR()
  const sim = await opts.rpc.simulateTransaction(raw)
  if (rpc.Api.isSimulationError(sim)) {
    throw new SimulationError(sim.error, sim.events)
  }
  return rpc
    .assembleTransaction(raw as Transaction, sim)
    .build()
    .toXDR()
}

export function buildExtendTtl(
  opts: FootprintTxOptions & { extendTo?: number }
): Promise<string> {
  const extendTo = opts.extendTo ?? MAX_EXTEND_TO
  if (
    !Number.isSafeInteger(extendTo) ||
    extendTo <= 0 ||
    extendTo > MAX_EXTEND_TO
  ) {
    throw new RangeError(
      `extendTo must be between 1 and ${MAX_EXTEND_TO} ledgers`
    )
  }
  return footprintTx(
    opts,
    Operation.extendFootprintTtl({ extendTo }),
    new SorobanDataBuilder().setReadOnly(opts.keys)
  )
}

export function buildRestore(opts: FootprintTxOptions): Promise<string> {
  return footprintTx(
    opts,
    Operation.restoreFootprint({}),
    new SorobanDataBuilder().setReadWrite(opts.keys)
  )
}
