# @pactlane/stellar

> **Testnet only.** Everything here targets Stellar testnet and the Pactlane
> testnet deployment. The contracts are unaudited. Do not point it at mainnet
> funds.

Typed Stellar and Soroban helpers shared by the Pactlane API, worker and web
server. Server-side only: `STELLAR_SDK_VERSION` reads the installed SDK
manifest from disk. Money is always `bigint` base units (USDC has 7 decimals,
so `10_000_000n` is 1 USDC).

## Install

Inside the monorepo, depend on the workspace package:

```json
{ "dependencies": { "@pactlane/stellar": "workspace:*" } }
```

```ts
import { PACTLANE_TESTNET, STELLAR_SDK_VERSION } from "@pactlane/stellar"

console.log(PACTLANE_TESTNET.kernel, STELLAR_SDK_VERSION)
```

## RPC

`createRpc` refuses an RPC that serves a different network than configured and
only allows plain `http://` for `localhost` and `127.0.0.1`.

```ts
import { loadEnv } from "@pactlane/config"
import { createRpc, probeRpc, rpcConfigFromEnv } from "@pactlane/stellar"

const rpc = await createRpc(rpcConfigFromEnv(loadEnv()), { timeoutMs: 15_000 })
const health = await probeRpc(rpc) // { ok, latestLedger, latencyMs, error? }
```

## Reading the kernel

```ts
import {
  KernelClient,
  readTokenBalance,
  PACTLANE_TESTNET,
} from "@pactlane/stellar"

const kernel = new KernelClient({ rpc })
const latest = await kernel.listJobs({ limit: 20 }) // newest first, via get_jobs
const job = await kernel.getJob(1n) // null when the job does not exist
const usdc = await readTokenBalance(rpc, PACTLANE_TESTNET.token, job!.client)
```

## Transactions

`prepareInvoke` simulates, then assembles an unsigned transaction. Kernel call
arguments are encoded by `kernelArgs`; the lower-level encoders are
`hashToScVal`, `amountToScVal` and `addressToScVal`.

```ts
import {
  kernelArgs,
  prepareInvoke,
  summarizeFees,
  PACTLANE_TESTNET,
} from "@pactlane/stellar"

const prepared = await prepareInvoke({
  rpc,
  networkPassphrase: PACTLANE_TESTNET.networkPassphrase,
  source: clientAddress,
  contractId: PACTLANE_TESTNET.kernel,
  method: "fund",
  args: kernelArgs({ method: "fund", id: 1n, expectedBudget: 20_000_000n }),
})
// prepared.xdr is unsigned; prepared.minResourceFee is a bigint in stroops
```

Simulation failures throw `SimulationError` with the raw diagnostic events.
`classifyError` turns any failure into a `StellarError` with a stable code,
and `contractError` names kernel and policy error codes.

## Submit

```ts
import { submitAndWait, PACTLANE_TESTNET } from "@pactlane/stellar"

const result = await submitAndWait(rpc, signedXdr, {
  networkPassphrase: PACTLANE_TESTNET.networkPassphrase,
})
if (result.status === "unknown") {
  // Not confirmed in time. Reconcile by result.hash; never resubmit blindly.
}
```

The result is a discriminated union: `success`, `failed`, `rejected`,
`try_again_later` or `unknown`. The helper sends once and never resubmits.

## Events

```ts
import {
  decodeEvent,
  KERNEL_EVENT_NAMES,
  PACTLANE_TESTNET,
} from "@pactlane/stellar"

const page = await rpc.getEvents({
  startLedger,
  filters: [{ type: "contract", contractIds: [PACTLANE_TESTNET.kernel] }],
})
for (const raw of page.events) {
  const event = decodeEvent(raw, KERNEL_EVENT_NAMES)
  if (!event) continue // unknown events are skipped, not fatal
  // event.topics[0] is the job id, event.topics[1] the party, when present
}
```

## Signer

`Signer` is the wallet-agnostic interface. `KeypairSigner` exists for tests
only, is exported from `@pactlane/stellar/testing`, and throws in production.

```ts
import {
  withSpendingPolicy,
  PACTLANE_TESTNET,
  type Signer,
} from "@pactlane/stellar"
import { KeypairSigner } from "@pactlane/stellar/testing"

const capped: Signer = withSpendingPolicy(KeypairSigner.random(), {
  maxPerTx: 10_000_000n,
  maxPerDay: 50_000_000n,
  allowedContracts: [PACTLANE_TESTNET.kernel, PACTLANE_TESTNET.token],
})
```

## Testnet accounts

```ts
import {
  buildUsdcTrustline,
  fundTestnetAccount,
  hasTrustline,
  usdcAsset,
} from "@pactlane/stellar"

await fundTestnetAccount(address) // "funded" or "already_funded"
const account = await (
  await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`)
).json()
if (!hasTrustline(account, usdcAsset())) {
  const unsignedXdr = buildUsdcTrustline({ account })
}
```

## Time and deadlines

```ts
import { isPastDeadline, ledgerNow } from "@pactlane/stellar"

const now = await ledgerNow(rpc) // ledger close time, cached for 5 s
const expired = await isPastDeadline(rpc, job.expiresAt)
```

## Storage lifetime (TTL)

Soroban entries live until a ledger number, then archive. Pactlane kernel jobs
renew to the network maximum on every write, so a live job never expires from
storage. A finished job that nobody touches archives about 180 days after its
last write.

| Helper                                  | Call it when                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getEntryTtl(rpc, key)`                 | You need the ledger an entry lives until, for example to warn before it archives. Returns `null` when the entry is missing or archived.                             |
| `buildExtendTtl({ source, keys, rpc })` | An entry you still read is getting close to archiving. Extends every key to `MAX_EXTEND_TO` ledgers (3,110,399) by default. Testnet rejects 3,110,400 as malformed. |
| `buildRestore({ source, keys, rpc })`   | A simulation reports that archived entries need restoring (`SimulationError` with `restoreRequired`). Restore first, then retry the original call.                  |

Both builders return unsigned XDR for the wallet to sign. Pass `rpc` to get a
simulated and assembled transaction with resource fees set; without it you get
the raw transaction to simulate yourself. For kernel jobs, the kernel's own
`extend_ttl(id)` is simpler: anyone can call it and it needs no footprint.
