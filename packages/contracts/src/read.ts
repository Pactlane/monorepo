import type { rpc, xdr } from "@stellar/stellar-sdk"
import { simulateRead, PACTLANE_TESTNET } from "@pactlane/stellar"

export type ReadContract = (
  contractId: string,
  method: string,
  args: xdr.ScVal[]
) => Promise<xdr.ScVal>

export function rpcRead(
  server: Pick<rpc.Server, "simulateTransaction">,
  networkPassphrase: string = PACTLANE_TESTNET.networkPassphrase
): ReadContract {
  return (contractId, method, args) =>
    simulateRead(server, networkPassphrase, contractId, method, args)
}
