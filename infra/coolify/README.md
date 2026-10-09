# Coolify deployment

Deploy `web`, `api`, `worker` and `docs` as separate services from this monorepo, backed by one Postgres and one Valkey instance. Terminate TLS at Coolify/Caddy. Secrets (0G service wallet, evaluator signer) live only in the platform secret store.
