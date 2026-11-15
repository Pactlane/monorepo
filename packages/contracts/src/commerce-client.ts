import type { rpc, xdr } from "@stellar/stellar-sdk"
import {
  kernelArgs,
  prepareInvoke,
  PACTLANE_TESTNET,
  type KernelCall,
} from "@pactlane/stellar"
import { COMMERCE_METHODS } from "./methods"

export interface UnsignedTx {
  xdr: string
}

export type Invoke = (
  contractId: string,
  method: string,
  args: xdr.ScVal[]
) => Promise<UnsignedTx>

export function rpcInvoke(opts: {
  rpc: Pick<rpc.Server, "getAccount" | "simulateTransaction">
  source: string
  networkPassphrase?: string
}): Invoke {
  return async (contractId, method, args) => {
    const prepared = await prepareInvoke({
      rpc: opts.rpc,
      networkPassphrase:
        opts.networkPassphrase ?? PACTLANE_TESTNET.networkPassphrase,
      source: opts.source,
      contractId,
      method,
      args,
    })
    return { xdr: prepared.xdr }
  }
}

type Without<T, K extends keyof T> = Omit<T, K>
type CallOf<M extends KernelCall["method"]> = Without<
  Extract<KernelCall, { method: M }>,
  "method"
>

export class CommerceKernelClient {
  readonly contractId: string
  readonly #invoke: Invoke

  constructor(invoke: Invoke, contractId: string = PACTLANE_TESTNET.kernel) {
    this.#invoke = invoke
    this.contractId = contractId
  }

  #call(call: KernelCall): Promise<UnsignedTx> {
    return this.#invoke(
      this.contractId,
      COMMERCE_METHODS[call.method],
      kernelArgs(call)
    )
  }

  createJob(p: CallOf<"create_job">) {
    return this.#call({ method: "create_job", ...p })
  }
  setProvider(p: CallOf<"set_provider">) {
    return this.#call({ method: "set_provider", ...p })
  }
  setBudget(p: CallOf<"set_budget">) {
    return this.#call({ method: "set_budget", ...p })
  }
  fund(p: CallOf<"fund">) {
    return this.#call({ method: "fund", ...p })
  }
  submit(p: CallOf<"submit">) {
    return this.#call({ method: "submit", ...p })
  }
  complete(p: CallOf<"complete">) {
    return this.#call({ method: "complete", ...p })
  }
  reject(p: CallOf<"reject">) {
    return this.#call({ method: "reject", ...p })
  }
  claimRefund(p: CallOf<"claim_refund">) {
    return this.#call({ method: "claim_refund", ...p })
  }
}
