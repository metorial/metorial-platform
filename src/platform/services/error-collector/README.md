# error-collector

A small Sentry-compatible error collector for installations without access to Sentry. Services keep
using their Sentry SDKs; their DSN points here instead. The collector groups the errors, keeps
counts over time with a scrubbed sample per group in its own PostgreSQL database, and serves a
download page for the error report, a zip to send to support. The page itself lists no errors. The
zip includes `report.html`, a viewer with charts, stack traces and the report inlined, which opens
from disk and blocks every network request.

## Ports

| Port    | Purpose                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `8095`  | Ingest: `POST /api/{project}/envelope/` and the legacy `POST /api/{project}/store/`.                                                                      |
| `8096`  | Admin: `/system/errors` (download page), `/system/errors/report.zip`, `/system/errors/report.json`. No authentication; expose it only to a trusted proxy. |
| `12121` | Health: `/` and `/doctor`.                                                                                                                                |

Report endpoints take `days` (default 30, up to the retention), `component` and `limit` (default
500, at most 2000).

## DSN

`http://<component>@<host>:8095/1`. The DSN key names the sending component; there is no secret.
Sentry SDKs reject keys with hyphens, so components send them with underscores (`core_api`) and the
collector reads underscores in the key as hyphens (`core-api`). Without a key the event's
`component` tag is used.

## Database

The collector creates its database (`metorial_error_collector` by default) on first start and
applies its migrations under a PostgreSQL advisory lock, so any number of replicas can start
together. If its user can't create databases, create the database beforehand.

## Configuration

| Variable                                        | Default                                               |
| ----------------------------------------------- | ----------------------------------------------------- |
| `ERROR_COLLECTOR_DATABASE_URL`                  | complete database URL; wins over the two below        |
| `METORIAL_POSTGRES_URL` / `DATABASE_SERVER_URL` | server URL; the path is replaced by the database name |
| `ERROR_COLLECTOR_DATABASE_NAME`                 | `metorial_error_collector`                            |
| `ERROR_COLLECTOR_INGEST_ADDRESS`                | `:8095`                                               |
| `ERROR_COLLECTOR_ADMIN_ADDRESS`                 | `:8096`                                               |
| `ERROR_COLLECTOR_HEALTH_ADDRESS`                | `:12121` (or `:$HEALTH_PORT`)                         |
| `ERROR_COLLECTOR_FLUSH_INTERVAL`                | `10s`                                                 |
| `ERROR_COLLECTOR_RETENTION_INTERVAL`            | `1h`                                                  |
| `ERROR_COLLECTOR_HOURLY_RETENTION`              | `14d`                                                 |
| `ERROR_COLLECTOR_RETENTION`                     | `180d`                                                |
| `ERROR_COLLECTOR_MAX_GROUPS`                    | `10000` stored groups                                 |
| `ERROR_COLLECTOR_MAX_PENDING_GROUPS`            | `5000` groups in memory between flushes               |
| `ERROR_COLLECTOR_MAX_CONCURRENT_REQUESTS`       | `64`                                                  |
| `ERROR_COLLECTOR_MAX_BODY_BYTES`                | `1048576` (compressed)                                |
| `ERROR_COLLECTOR_MAX_EXPANDED_BYTES`            | `10485760` (decompressed)                             |

New groups beyond either group limit are counted in one overflow group per component
(`TooManyDistinctErrors`), which the report lists first.

## What is stored

Level, platform, release, environment, timestamp, the exception chain (type, scrubbed value,
mechanism, frames with file, module, function, line and column), the scrubbed message, the runtime
and OS context, and the tags `component`, `queue`, `route`, `method`, `status`, `handler`,
`integration`, `error_code`, `provider` and `step`. From the `details` context, up to 40 scalar
values, and from the `log` context, the last 50 lines; both are scrubbed and truncated.
Requests, users, breadcrumbs, extra data, other contexts, frame variables and source lines are
dropped on receipt.
Credentials, tokens, keys, email addresses, public IP addresses and URL query strings are replaced
with placeholders.

## Failure reports

In the on-prem edition, services also report failures they handle themselves, through
`reportFailure` in `@metorial/error-reporting/failure`. Each carries tags and `details` saying what
failed, and the end of its log:

| Type                          | Reported by   | When                                                                                                                                                            |
| ----------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BuildFailed`                 | build service | A build fails because of the build infrastructure: evicted or unschedulable jobs, timeouts, provider faults. A workflow's own commands failing is not reported. |
| `IntegrationDeploymentFailed` | Slates hub    | A first-party integration version fails to build or deploy.                                                                                                     |
| `IntegrationDiscoveryFailed`  | Slates hub    | A deployed integration version fails discovery, once per version until it is redeployed.                                                                        |
| `IntegrationServerError`      | Slates hub    | An integration call fails with a server error; replaces the generic Sentry event there.                                                                         |
| `ServerDeploymentFailed`      | MCP runtime   | A custom MCP server deployment fails or times out because of the platform, not because of the server's code or image.                                           |

## Grouping

An event's `fingerprint` wins (`{{ default }}` expands to the default grouping). Otherwise the
in-app frames of each exception (module or file name plus function, without line numbers, since
bundled services change line numbers every build), else the exception type and normalized value,
else the normalized message. Groups never span components. `GroupingVersion` is stored per group.

## Development

```sh
go test ./...
```

The store tests need a PostgreSQL server; they create and drop their own databases:

```sh
ERROR_COLLECTOR_TEST_DATABASE='postgres://postgres:test@127.0.0.1:5432/?sslmode=disable' go test ./...
```
