# @pactlane/contracts

> **Testnet only.** The contracts are unaudited and there is no mainnet
> deployment.

Typed access to the Pactlane contracts deployed from
[pactlane-protocol](https://github.com/Pactlane/pactlane-protocol), and to the
Stellar-8004 registries. This package never hand-writes an ABI: contract ids,
wasm hashes and source commits come from the protocol's deployment manifest,
and calls are encoded with `@pactlane/stellar`.

## How the two repos connect

1. **pactlane-protocol** builds the contracts, deploys them to testnet and
   records each contract's id, wasm SHA-256, source commit and constructor
   arguments in `deployments/testnet.json`. Its `verify-deployment.ts` checks
   that file against the chain.
2. **This package** keeps a copy of that manifest in
   `fixtures/testnet.example.json` and validates it with
   `deploymentManifestSchema`, which follows the protocol's own schema.
3. **compat.json** lists which wasm hashes this SDK version supports, so an
   unexpected kernel build is caught instead of misread.
4. **At startup**, a service loads the manifest with `loadManifest` (optionally
   pinned by `expectedSha256`) and calls `assertEnvMatchesManifest`, refusing to
   start if its configured ids differ from the manifest.

## Updating to a new deployment

1. Copy the new `deployments/testnet.json` from the protocol repo into
   `fixtures/testnet.example.json`.
2. Run `bun run validate-manifest packages/contracts/fixtures/testnet.example.json`.
3. Add the new wasm hash to `compat.json`. If the old build stops working with
   this SDK, move it to `unsupported` with the reason.
4. Update any pinned `expectedSha256` to the new file's hash.
5. Run `bun run typecheck` and `bun run test`, and commit everything together
   with a message naming the protocol commit.

## What never to do

- Never pipe a remote script into a shell (`curl ... | bash`) to fetch
  artifacts.
- Never point at a floating branch such as `main` of the protocol repo
  without a pin: always check the manifest's hash or commit.
- Never load a manifest over plain `http://`. `loadManifest` refuses it.
- Never hand-edit contract ids or wasm hashes. Copy them from the protocol's
  manifest.
- Never add a mainnet manifest before an independent security review.

## Kernel methods

`COMMERCE_METHODS` names every public function of the deployed
`pactlane-commerce` kernel. The behaviour of each one is specified in the
protocol's `specs/INTERFACES.md`, and its ERC-8183 counterpart is in
[`content/protocol/erc-8183-mapping.md`](../../content/protocol/erc-8183-mapping.md).

| Constant       | Signs                      | What it does                                                  |
| -------------- | -------------------------- | ------------------------------------------------------------- |
| `create_job`   | client                     | Opens a job with an evaluator, expiry and task spec hash      |
| `set_provider` | client                     | Sets the provider once, while the job is open                 |
| `set_budget`   | client or provider         | Proposes the budget; a later proposal replaces it             |
| `fund`         | client                     | Moves exactly the agreed budget into escrow                   |
| `submit`       | provider                   | Records the deliverable hash on a funded job                  |
| `complete`     | evaluator                  | Approves the work and pays the provider the full budget       |
| `reject`       | client (open) or evaluator | Cancels an open job, or rejects funded work and refunds       |
| `claim_refund` | anyone                     | Refunds the client once a funded job has expired              |
| `extend_ttl`   | anyone                     | Keeps a job's storage alive                                   |
| `get_job`      | read-only                  | Returns one job                                               |
| `get_jobs`     | read-only                  | Returns up to 50 consecutive jobs                             |
| `job_count`    | read-only                  | Number of jobs ever created, which is also the highest job id |
| `token`        | read-only                  | The payment token                                             |
| `admin`        | read-only                  | The admin allowed to upgrade the kernel                       |
| `upgrade`      | admin                      | Replaces the kernel code in place, keeping its id and jobs    |

## Usage

```ts
import {
  CommerceKernelClient,
  IdentityRegistryClient,
  assertEnvMatchesManifest,
  loadManifest,
  rpcInvoke,
  rpcRead,
} from "@pactlane/contracts"

const manifest = await loadManifest(process.env.PACTLANE_DEPLOYMENT_MANIFEST!)
assertEnvMatchesManifest(env, manifest)

const kernel = new CommerceKernelClient(
  rpcInvoke({ rpc, source: clientAddress })
)
const { xdr } = await kernel.fund({ id: 1n, expectedBudget: 20_000_000n })
// xdr is unsigned: sign it with the client's wallet, then submit.

const agent = await new IdentityRegistryClient(rpcRead(rpc)).getAgent(0)
```
