# sume-connector (delta)

## ADDED Requirements

### Requirement: Sume provider definition
The provider SHALL declare name `sume`, Bearer authentication,
`https://api.sume.com` as its base URL, and one credit pool named `default`
labelled US dollars. Every submit SHALL send `Idempotency-Key:
{runId}:submit`. A 2xx submit SHALL park the run with `data.job.id` as its
external run id; a non-2xx submit SHALL complete as a provider error with
zero usage; a 2xx submit without a job id SHALL throw a non-retriable error.

#### Scenario: A rejected submit is not billed
- **WHEN** the submit answers 400, 402 or 429
- **THEN** the run completes with that status as a provider error
- **AND** usage is zero and no job is polled

#### Scenario: A retried submit reuses the same Sume job
- **WHEN** the host retries the start tick of the same run
- **THEN** the retry carries the same `Idempotency-Key`
- **AND** Sume answers with the job it already created

### Requirement: Job polling and terminal outcomes
The provider SHALL poll `GET /v1/jobs/{id}` every 30 seconds. `queued`,
`processing` and any status it does not know SHALL keep the run in flight on
the same job id. `failed` SHALL complete with HTTP 500 and `canceled` with
HTTP 409, both as provider errors with zero usage. `completed` SHALL keep the
run in flight until `usage_summary.final` is `true` (absent, `null` or `false`
all wait), then complete with HTTP 200 when the job carries a video artifact
with a URL, or HTTP 502 with zero usage when it does not. A 404 on the poll
SHALL complete the run as a provider error with zero usage; any other non-2xx
answer to the poll SHALL throw a retriable error rather than settle the run.

#### Scenario: A refused edit bills nothing
- **WHEN** the job ends `failed` because the source or a photo was refused
- **THEN** the run completes as a provider error with HTTP 500
- **AND** usage is zero

#### Scenario: Settlement waits for the captured charge
- **WHEN** the job reads `completed` before `usage_summary.final` is `true`
- **THEN** the run keeps polling
- **AND** completes on the first poll where the summary is final

#### Scenario: A delivered video is never free
- **WHEN** a completed job with a video has a final summary that is not `captured`
- **THEN** no claim is made and the rate-card fold bills the source seconds

### Requirement: Settlement from the captured charge
A successful run SHALL claim `usage_summary.captured_usd_cents / 100` US
dollars in the `default` pool when `usage_summary.status` is `captured`, and
SHALL remove `usage_summary` from the output. The claim SHALL win over the
rate-card fold; the fold stays the cross-check.

#### Scenario: The captured charge is the bill
- **WHEN** a 720p job completes with `captured_usd_cents` 140 for a 5 s source
- **THEN** usage credits are `{default: 1.4}`
- **AND** the fold of 5 source seconds × $0.2766 rides out as the mismatch cross-check

### Requirement: Sume Remix endpoints
The connector SHALL provide three endpoints, each a POST with a strict JSON
body:

- `/v1/video/sume-remix-motion-transfer` → `/v1/sume/remix/motion-transfer/v1.0`
  and `/v1/video/sume-remix-object-swap` → `/v1/sume/remix/object-swap/v1.0`:
  `video_url` (HTTPS, required), `image_urls` (1 to 8 HTTPS URLs, required),
  `prompt` (up to 10,000 characters), `resolution` (`480p`, `720p` or
  `1080p`, default `720p`) and `duration` (whole seconds, 4 to 15).
- `/v1/video/sume-remix-restyle` → `/v1/sume/remix/restyle/v1.0`:
  `video_url`, `preset_id` (one of Sume's 20 style ids, required), `prompt`,
  `resolution` and `duration`; no `image_urls`.

Each SHALL price per second of source video by resolution: $0.123 at 480p,
$0.2766 at 720p and $0.6804 at 1080p. The estimate SHALL hold `duration`
seconds, or 15 seconds when `duration` is absent, on the requested line. The
evidence SHALL count the job's source seconds on the requested line.

#### Scenario: Estimate without a duration
- **WHEN** a caller submits a 1080p motion transfer without `duration`
- **THEN** the estimate holds 15 seconds on the `1080p` line, $10.206

#### Scenario: Restyle refuses reference photos
- **WHEN** a caller sends `image_urls` to the restyle endpoint
- **THEN** input validation fails before any request is made
