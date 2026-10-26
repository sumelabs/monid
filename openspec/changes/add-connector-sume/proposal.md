# Proposal: add-connector-sume

## Why

Sume Remix edits a video a caller already has: it recasts the people, swaps
an object, or restyles the whole picture, while the motion, camera, length
and sound of the source stay. Sume plans the edit itself from the source and
the reference photos, so a caller sends media and an optional note, not an
engineered prompt, and gets back the finished clip with the source's own
sound. It is one product with its own API, its own price per second of
source video, and its own failure handling, so it is a provider of its own
rather than a row under any model vendor already in the catalog.

## What Changes

- Add the `sume` provider: Bearer authentication against
  `https://api.sume.com`, an `Idempotency-Key` derived from the run id on
  every submit, asynchronous polling of `GET /v1/jobs/{id}`, and settlement
  from the job's own `usage_summary.captured_usd_cents` in a US-dollar pool.
- Add three endpoints, one per Sume Remix workflow:
  - `/v1/video/sume-remix-motion-transfer` → `POST /v1/sume/remix/motion-transfer/v1.0`
  - `/v1/video/sume-remix-object-swap` → `POST /v1/sume/remix/object-swap/v1.0`
  - `/v1/video/sume-remix-restyle` → `POST /v1/sume/remix/restyle/v1.0`
- Price each endpoint per second of source video by resolution: $0.123 at
  480p, $0.2766 at 720p, $0.6804 at 1080p. These are Sume's published
  Remix prices.

## Capabilities

- `sume-connector`.

## Non-goals

- Any model Sume routes to another vendor without its own pipeline. Those
  vendors are listed directly; this connector does not resell them.
- The restyle presets listing route; the 20 style ids are an enum on the
  restyle input.
- Webhook delivery; the connector polls the documented job route.

## Impact

New connector tree (`connectors/sume/`), this change directory, and three
new ids in `connectors/ids.lock.json`. No engine, shared, config or
category changes.
