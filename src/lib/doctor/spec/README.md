# Doctor protocol v1

Every service answers `GET /doctor` on its health port with a report of the checks it ran. An
aggregator (the on-prem gateway) fetches the reports of every replica, merges them and decides what
to show. This directory is the language-neutral contract. The implementations live next to it:

| Path | Package |
| --- | --- |
| `../node` | `@lowerdeck/doctor` |
| `../go` | `github.com/metorial/metorial-platform/src/lib/doctor/go`, package `doctor` |
| `../rust` | crate `lowerdeck-doctor` |

All three run their tests against the fixtures here.

## HTTP

- `GET /doctor` returns `200` with a report whenever the doctor ran, also when checks failed, and
  `503` only when the doctor itself could not run. The response carries `x-metorial-doctor: 1` and
  `cache-control: no-store`. Other methods get `405`.
- `?fresh=1` bypasses the result cache (see runner semantics).
- The endpoint is unauthenticated. It must only be reachable from the aggregator, and reports are
  redacted.

## Report

[`report.schema.json`](report.schema.json) is normative. Implementations write the canonical form:
every property in the schema is present, with `null` for absent optional values and `[]` for empty
`resolution.steps`. Readers accept the optional properties being absent and treat that as `null`.
Unknown properties are ignored by readers.

- `releaseVersion` is the deploy-time release (`METORIAL_RELEASE_VERSION`) and is the only version
  aggregators compare. `buildVersion` is what the image carries (`METORIAL_VERSION`) and is
  informational, because CI reuses unchanged images across releases.
- `processStartedAt` is when the process started, `startedAt` and `generatedAt` when this run
  started and finished. `ageMs` is how old the run was when it was returned.
- `runId` changes per run. Requests that shared a run see the same `runId`.
- Check ids are dotted lowercase (`postgres.core.connect`). `target` is a dedupe key for the
  resource the check is about (`postgres:metorial_core@db.internal:5432`), so an aggregator can show
  one issue seen from many components.
- `status`: `error` means the check threw, `timeout` that it ran over its budget. Aggregators treat
  both like `fail`. `severity` says what a failure means: only `critical` blocks.
- `cachedAt` is set when `minIntervalMs` reused an earlier result of the check.

## Runner semantics

- Checks run concurrently, at most 4 at a time, each with its own timeout (default 5s) inside an
  overall run budget of 12s. A check that exceeds either reports `timeout`.
- A check that throws reports `error` with the described error in `details.error`.
- `dependsOn`: a check whose dependency did not pass or warn reports `skip` with
  `details.dependsOn` listing the failed dependency ids. Unknown dependencies and cycles report
  `error`.
- `minIntervalMs`: within the interval the check's previous result is reused, with `cachedAt` set
  to when that result was produced. This applies to fresh runs as well.
- Results keep registration order.

### Debouncing

Requests never start checks directly. Each process has at most one run in flight:

1. A run is in flight: wait for it and return its report. This includes `?fresh=1`.
2. No run in flight and the last report is younger than `cacheTtlMs` (30s): return it with
   `cached: true` and its `ageMs`.
3. Otherwise start a run. Requests that arrive while it runs join it.

`?fresh=1` skips step 2 unless the last run finished less than `freshMinIntervalMs` (10s) ago.

A run is detached from the request that started it: a requester that times out or disconnects
stops waiting, but the run continues for everyone else and still fills the cache.

Every implementation tests these cases with a check that counts its invocations:

- six concurrent requests run the check once and all get the same `runId`
- a request within the cache TTL gets `cached: true`
- `fresh` during a run joins it
- `fresh` within `freshMinIntervalMs` of a finished run gets that run's report
- a requester that aborts doesn't cancel the run for the others

## Redaction

Implementations redact `message`, `target` and `details` of every check before serializing. Top-level
fields and `resolution` are authored by the service and are not redacted.
[`fixtures/redaction.json`](fixtures/redaction.json) holds the vectors; `redact(input)` must
produce `expected` exactly.

Values:

- Objects: a property whose key is secret gets `"***"` unless its value is `null`. A key is secret
  when, lowercased with everything but `a-z0-9` removed, it contains `password`, `passwd`,
  `secret`, `token`, `apikey`, `privatekey`, `credential`, `authorization`, `cookie` or
  `signature`, or equals `pwd`, `pass` or `auth`. Other properties are redacted recursively.
- Arrays are redacted element by element.
- An object or array at depth 8 (the input value is depth 0) becomes `"[truncated]"`.
- Numbers, booleans and `null` are unchanged.

Strings, in this order:

1. PEM blocks `-----BEGIN <LABEL>-----` … `-----END <LABEL>-----` become `[redacted <LABEL>]`.
2. URL passwords: `scheme://user:password@` becomes `scheme://user:***@`.
3. Query parameters named (case-insensitively) `password`, `passwd`, `pwd`, `secret`, `token`,
   `access_token`, `refresh_token`, `id_token`, `api_key`, `apikey`, `key`, `sig`, `signature`,
   `credential`, `auth`, `x-amz-signature`, `x-amz-credential` or `x-amz-security-token`, after
   `?`, `&` or `;`, get the value `***`.
4. `Bearer <token>` (case-insensitive, token of 8 or more characters from `A-Za-z0-9._~+/=-`)
   becomes `Bearer ***`, keeping the original spelling of the word.
5. Strings longer than 2048 code points are cut to 2048 and get `…[truncated]` appended.

The regular expressions, in RE2 syntax:

```text
pem    -----BEGIN ([A-Z0-9 ]+)-----[\s\S]*?-----END [A-Z0-9 ]+-----     → [redacted $1]
url    ([a-zA-Z][a-zA-Z0-9+.-]*://)([^\s:/?#@]*):([^\s/?#@]*)@             → $1$2:***@
query  (?i)([?&;](?:password|passwd|pwd|secret|token|access_token|refresh_token|id_token|api_key|apikey|key|sig|signature|credential|auth|x-amz-signature|x-amz-credential|x-amz-security-token)=)[^&\s#"']*  → $1***
bearer (?i)\b(bearer)\s+[A-Za-z0-9._~+/=-]{8,}                             → $1 ***
```

## Error classification

`describeError` (per language) returns `{ kind, code, message, hint }`. `code` is the most specific
code found on the error or its causes (an errno, SQLSTATE, AWS error code, gRPC status name,
Redis error prefix, MongoDB code name, Prisma code), `kind` comes from the shared table in
[`fixtures/error-codes.json`](fixtures/error-codes.json), falling back to the HTTP status table,
then to language-specific inspection (network errors, timeouts, TLS errors), then `unknown`.
`hint` is the table's text for the kind. `message` is redacted. Each implementation's tables must
equal the fixture.
