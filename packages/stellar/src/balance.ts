import { rpc, scValToNative } from "@stellar/stellar-sdk"
import { PACTLANE_TESTNET, contractError, simulateRead } from "./kernel"
import { addressToScVal } from "./scval"
import { SimulationError } from "./tx"

const SAC_TRUSTLINE_MISSING = 13

export async function readTokenBalance(
  server: Pick<rpc.Server, "simulateTransaction">,
  tokenId: string,
  address: string,
  networkPassphrase: string = PACTLANE_TESTNET.networkPassphrase
): Promise<bigint> {
  try {
    const value = await simulateRead(
      server,
      networkPassphrase,
      tokenId,
      "balance",
      [addressToScVal(address)]
    )
    const native = scValToNative(value)
    if (typeof native !== "bigint") {
      throw new Error(`Unexpected balance type ${typeof native}`)
    }
    return native
  } catch (error) {
    if (
      error instanceof SimulationError &&
      contractError(error.message)?.code === SAC_TRUSTLINE_MISSING
    ) {
      return 0n
    }
    throw error
  }
}
