# Tasks: add-connector-sume

## 1. Connector

- [x] 1.1 Add the `sume` provider: Bearer auth, idempotent submit, job polling, settlement from `captured_usd_cents`
- [x] 1.2 Add the shared Remix input fragments and the per-source-second rate card
- [x] 1.3 Add the motion transfer, object swap and restyle endpoints with strict input schemas

## 2. Verification

- [x] 2.1 Add lifecycle tests: one recorded success chain per endpoint (`recorded-*`, Sume dev API, public-domain sources) and `synthetic-` chains for the error and settling paths
- [x] 2.2 Add the three `sume#` ids to `connectors/ids.lock.json` as `deno task ids:check --update` writes them; the lock on `main` already drifts for other connectors, so only the `sume#` lines change
- [x] 2.3 Run `deno fmt`, `deno lint`, `deno task check` and `deno task test` with no network
