# Security Policy

Pactlane is **testnet-only** software. The upstream Stellar-8183 escrow kernel it builds on describes itself as unaudited. Do not use Pactlane with mainnet funds.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private vulnerability reporting ("Security" → "Report a vulnerability") on this repository. Include:

- affected package/app and commit
- reproduction steps or a proof of concept
- impact (funds at risk, data exposure, denial of service, …)

We aim to acknowledge reports within 3 business days.

## Scope highlights

- Signature and replay handling in `@pactlane/negotiation`
- Canonical hashing in `@pactlane/core`
- Any path where the API or worker could influence settlement
- Secret handling (0G service wallet, evaluator signer)

Contract issues belong to the `pactlane-protocol` repository.

## Ground rules we hold ourselves to

- The hosted API can never release escrow funds.
- Simulation mode is always labeled and can never claim real payouts.
- No secrets in client bundles, logs or CI artifacts.
