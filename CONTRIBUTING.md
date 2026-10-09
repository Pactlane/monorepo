# Contributing to Pactlane

Thanks for helping agents make deals.

## Setup

```bash
bun install
bun run typecheck
bun run test
bun run dev
```

Requires Node ≥ 22.22 and Bun 1.4.

## Workflow

1. Pick an issue (`good-first-issue` and `help-wanted` are the best starting points).
2. Branch from `main`: `feat/<area>-<short-name>`.
3. Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(core): …`, `fix(web): …`.
4. Keep PRs focused; add tests for protocol logic.
5. CI must be green. Settlement, signing and key-handling changes need two maintainer reviews.

## Labels

`good-first-issue` · `help-wanted` · `area:docs` · `area:web` · `area:api` · `area:sdk` · `area:security` · `integration:0g` · `integration:stellar` · `integration:axl` · `blocked` · `requires-maintainer-review`

## Rules of thumb

- Money is always integer atomic units (`bigint`), never floats.
- Hash canonical JSON only — never `JSON.stringify` of arbitrary objects.
- Never mark something verified/completed unless it is chain-confirmed.
