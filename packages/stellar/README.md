# @pactlane/stellar

Typed Stellar and Soroban helpers shared by the Pactlane API, worker and web
server. Server-side only: it reads the installed SDK version from disk.

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
