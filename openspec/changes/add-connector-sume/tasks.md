# Tasks: add-connector-sume

## 1. Connector

- [x] 1.1 Add the `sume` provider: Bearer auth, idempotent submit, job polling, settlement from `captured_usd_cents`
- [x] 1.2 Add the shared Remix input fragments and the per-source-second rate card
- [x] 1.3 Add the motion transfer, object swap and restyle endpoints with strict input schemas

## 2. Verification

- [x] 2.1 Add replay fixtures (`synthetic-` until recorded with a live key) and lifecycle tests
- [x] 2.2 Add the three `sume#` ids to `connectors/ids.lock.json` as `deno task ids:check --update` writes them; the lock on `main` already drifts for other connectors, so only the `sume#` lines change
- [x] 2.3 Run `deno fmt`, `deno lint`, `deno task check` and `deno task test` with no network
- [ ] 2.4 Replace the synthetic success chains with `deno task record` output once a Sume key is provisioned for the connector
