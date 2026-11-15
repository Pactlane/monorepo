# ERC-8183 mapping

How Pactlane job actions map onto [ERC-8183 Agentic Commerce](https://ercs.ethereum.org/ERCS/erc-8183)
and the `pactlane-commerce` kernel deployed on Stellar testnet
(`CB3DJM7B7THZYCYINV22NATMRV3AFG4XX7235KYP2VVGOTRG2CGVKIQS`). The kernel's
own specification is `specs/INTERFACES.md` and `specs/ERC_8183_MAPPING.md` in
[pactlane-protocol](https://github.com/Pactlane/pactlane-protocol).

## Actions

| Pactlane action     | ERC-8183      | Kernel method                                                     | Required auth                               | State transition                                                  |
| ------------------- | ------------- | ----------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| Open a job          | `createJob`   | `create_job(client, provider?, evaluator, expires_at, spec_hash)` | `client`                                    | none → Open                                                       |
| Choose the provider | `setProvider` | `set_provider(id, provider)`                                      | client                                      | Open → Open (once, while live)                                    |
| Propose a budget    | `setBudget`   | `set_budget(id, actor, amount)`                                   | `actor`, who must be the client or provider | Open → Open (while live)                                          |
| Fund escrow         | `fund`        | `fund(id, expected_budget)`                                       | client                                      | Open → Funded (needs a provider and the exact budget, while live) |
| Deliver work        | `submit`      | `submit(id, work_hash)`                                           | provider                                    | Funded → Submitted (while live)                                   |
| Approve and pay     | `complete`    | `complete(id, reason)`                                            | evaluator                                   | Submitted → Completed (while live)                                |
| Cancel an open job  | `reject`      | `reject(id, reason?)`                                             | client                                      | Open → Rejected                                                   |
| Reject funded work  | `reject`      | `reject(id, reason?)`                                             | evaluator                                   | Funded or Submitted → Rejected, client refunded (while live)      |
| Refund after expiry | `claimRefund` | `claim_refund(id)`                                                | none; anyone may call                       | Funded or Submitted → Expired, client refunded                    |

"While live" means the ledger time is before `expires_at`. From `expires_at`
on, only `claim_refund` can move a funded job, so payout and refund are never
both possible.

When the evaluator is the `pactlane-evaluation-policy` contract, a signer in
its signer set calls the policy's `complete(signer, id, reason)` or
`reject(signer, id, reason?)` instead, and the policy calls the kernel.

## Divergences from ERC-8183

Each is stricter than the ERC.

1. No hooks.
2. Client, provider and evaluator must be three different addresses. The ERC
   lets the evaluator be the client.
3. `submit`, `complete`, the evaluator's `reject` and `fund` fail once a job has
   expired.
4. A job can last at most 90 days, so it cannot outlive its storage lifetime.
5. The job description is a 32-byte `spec_hash`. The full task spec lives off
   chain, keyed by that hash.
6. `complete` requires a `reason` hash, binding every payout to evaluation
   evidence.
7. No platform or evaluator fees, and no partial settlement: a job pays the full
   budget to the provider or refunds it all to the client.
8. The kernel has an admin who can replace its code in place with `upgrade`,
   keeping the contract id, every job and the escrow. On testnet this is an
   accepted risk; before mainnet the admin must be a multisig or timelock, or
   upgrades must be removed.

## Events

The kernel emits the events ERC-8183 lists, in snake_case: `job_created`,
`provider_set`, `budget_set`, `job_funded`, `job_submitted`, `job_completed`,
`job_rejected`, `job_expired`, `payment_released` and `refunded`, plus
`upgraded`. Topics are `[name, job_id, party]`, except `job_expired`
(`[name, job_id]`) and `upgraded` (`[name, admin]`).
