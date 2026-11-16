# Object Storage Service

A lightweight, universal object storage service. It provides a simple HTTP API for managing buckets and objects, with support for multiple storage backends including local filesystem, AWS S3, Google Cloud Storage, and Azure Blob Storage.

## Features

- RESTful HTTP API for object storage operations
- Multi-backend support (local, S3, GCS, Azure)
- Support for metadata directly in the storage backend
- ETag generation for cache validation

## Installation

### Using Docker

The Docker image does not include configuration. You must provide it externally using either a config file or environment variables.

**Option 1: Using a configuration file (recommended)**

Copy `config.example.toml` to `config.toml` and modify it for your needs, then mount it into the container:

```bash
docker pull ghcr.io/metorial/object-storage:latest

# Create your config.toml first (see Configuration section below)
docker run -p 8080:8080 \
  -e CONFIG_PATH=/app/config/config.toml \
  -v $(pwd)/config.toml:/app/config/config.toml:ro \
  -v object-store-data:/app/data \
  ghcr.io/metorial/object-storage:latest
```

**Option 2: Using environment variables**

Configure entirely through environment variables without a config file:

```bash
docker run -p 8080:8080 \
  -e OBJECT_STORE__SERVER__HOST=0.0.0.0 \
  -e OBJECT_STORE__SERVER__PORT=8080 \
  -e OBJECT_STORE__BACKEND__TYPE=local \
  -e OBJECT_STORE__BACKEND__ROOT_PATH=/app/data \
  -e OBJECT_STORE__BACKEND__PHYSICAL_BUCKET=object-store-data \
  -v object-store-data:/app/data \
  ghcr.io/metorial/object-storage:latest
```

**Using Docker Compose**

```yaml
services:
  object-storage:
    image: ghcr.io/metorial/object-storage:latest
    ports:
      - "8080:8080"
    volumes:
      - ./config.toml:/app/config/config.toml:ro
      - object-store-data:/app/data
    environment:
      - CONFIG_PATH=/app/config/config.toml
      - RUST_LOG=info

volumes:
  object-store-data:
```

### Building from Source

```bash
cargo build --release
./target/release/object-store-service
```

## Configuration

The service requires configuration to be provided externally. You can use either a TOML file or environment variables.

### Configuration File

Create a `config.toml` file and set the `CONFIG_PATH` environment variable:

```bash
export CONFIG_PATH=/path/to/config.toml
./object-store-service
```

**Example config.toml for local development:**

```toml
[server]
host = "127.0.0.1"
port = 8080

[backend]
type = "local"
root_path = "./data"
physical_bucket = "object-store-data"
```

**Example config.toml for Docker:**

```toml
[server]
host = "0.0.0.0"  # Accept connections from any interface
port = 8080

[backend]
type = "local"
root_path = "/app/data"  # Use container paths
physical_bucket = "object-store-data"
```

### Environment Variables

All config options can be set via environment variables with the `OBJECT_STORE__` prefix. Nested keys use double underscores:

```bash
export OBJECT_STORE__SERVER__HOST=0.0.0.0
export OBJECT_STORE__SERVER__PORT=8080
export OBJECT_STORE__BACKEND__TYPE=local
export OBJECT_STORE__BACKEND__ROOT_PATH=/app/data
export OBJECT_STORE__BACKEND__PHYSICAL_BUCKET=object-store-data
```

Environment variables override config file values, allowing you to use a base config file and override specific settings.

### Uploads

Objects larger than 8 MiB are streamed to the backend as multipart uploads (S3 parts, Azure blocks,
a GCS resumable session, or a temporary file renamed into place locally), so the object is only
visible once it is complete and a failed upload leaves nothing behind. Parts are retried on
transient provider errors, and every upload's part buffers count against one shared memory budget.

```toml
[server]
request_timeout_secs = 60        # Not applied to object uploads and copies
upload_idle_timeout_secs = 60    # An upload body that sends nothing for this long is aborted
upload_min_bytes_per_sec = 16384 # ...as is one slower than this on average (0: no minimum)
upload_min_rate_grace_secs = 60  # Allowance every upload gets on top of the minimum rate

[uploads]
part_concurrency = 4               # Parts in flight per upload (GCS and local: always 1)
min_part_size_bytes = 16777216     # Raised to the backend's minimum
memory_budget_bytes = 1073741824   # Shared by client uploads and copies; 7/8 of it caps the part size
```

A part buffer's share of the budget grows with the bytes that actually arrived: in small steps up
to 1 MiB from an eighth of the budget set aside for that, then the rest of the part at once, and
never more than `Content-Length` says is left. A client that trickles data in therefore holds a
few KiB rather than a whole part, and a 1 KB upload reserves 1 KiB. Only time spent waiting on the
client counts against the minimum rate, not time an upload waits for the budget or the backend.

A request's `Content-Length` is used to size the parts. Without one, parts start at
`min_part_size_bytes` and double every tenth of the backend's part limit; with the defaults an
upload of unknown size can reach about 4.4 TiB on S3. Two uploads racing to the same key on Azure
cannot both win: the one that commits second fails with `409 Conflict`.

A request body that breaks off (the client disconnects, or sends a malformed or short body) fails
the upload with `400 Bad Request`, and one cut off by the idle timeout or the minimum rate with
`408 Request Timeout`; storage failures stay `500`.

Abandoned uploads are cleaned up: the local backend removes temporary files untouched for six hours
from `<root_path>/.uploads`, at startup and every minute (uploads in progress touch theirs every ten
minutes). S3 uploads a crashed instance never aborted are left to the bucket's lifecycle rule; the
deployment's buckets abort incomplete multipart uploads after a day.

The local backend keeps object data at `<root_path>/<physical_bucket>/<key>` and its metadata at
`<root_path>/.meta/<physical_bucket>/<key>`, so any two keys stay independent. Objects written by
earlier versions, with a `<key minus extension>.meta.json` file next to the data, are still read,
and that file is moved out of the way when another object is written over it. `physical_bucket`
cannot be `.meta` or `.uploads`.

### ZIP archives

The service can pack stored objects into a ZIP archive written back to a bucket. The archive is
streamed: sources are read with ranged reconnects, compressed entry by entry and pushed through the
same multipart uploader as any other object, so memory stays bounded whatever the archive's size.
Archive part buffers have a memory budget of their own (`upload_memory_budget_bytes`), so zip jobs
and client uploads never wait on each other's memory.

- Every source is checked with a HEAD before anything is written. The archive's worst-case size is
  derived from those sizes, and an archive that could exceed `max_archive_bytes` (or the backend's
  object limit) is rejected before any upload starts.
- A source that changes while it is read (different ETag or size, or more or fewer bytes than its
  HEAD said) fails the archive with `source_changed`. A dropped connection resumes from the last byte
  read, up to five times per source. A `crc32` or `size` given in the request must match the data.
- Entries are sorted by path. Unsafe characters are replaced, names that collide case- or
  Unicode-insensitively are renamed (`readme~2.md`) and reported, and malformed or repeated paths are
  rejected. Given the same sources, settings and request, the archive is byte-for-byte identical
  however it is fetched or uploaded.
- Compression: `"store"` and `"deflate"` are honoured as given. With `"auto"`, files with an already
  compressed extension or content type (images, video, audio, archives, fonts, PDF) are stored. Other
  small files are deflated only when that comes out smaller. For a large file, the first 256 KiB is
  test-compressed and the file is deflated only if that saves at least 10%. A large file is deflated
  in independent 1 MiB blocks, several at once (at most one per CPU across all jobs), which makes it
  about 0.3% larger than one stream would and leaves the output the same however many run at once.
- ZIP64 is used only where a field needs it. A local header (and its data descriptor) is ZIP64 when
  the entry's declared size or its worst-case compressed size reaches 4 GiB; an entry that merely
  starts past 4 GiB keeps a plain local header and a 16-byte descriptor, and only its central
  directory record carries the 64-bit offset. Known interop note: a deflated file of about 3.56 to
  4 GiB is streamed before its compressed size is known, and its worst case (the size plus 1/8)
  passes 4 GiB, so it gets a ZIP64 local header and a 24-byte descriptor although its final sizes
  would fit 32 bits. Readers that follow the local header handle this; a streaming reader that
  guesses the descriptor size from the sizes it sees may not.
- Archives under 8 MiB are written with a single request. Larger ones use multipart, and anything that
  fails or is canceled aborts the upload, so an existing object at the destination is left untouched.
- Destinations may not be in a reserved prefix (`.metadata`, `.uploads`, `.bucket`) or overwrite one
  of the archive's own sources.

```toml
[zip]
max_concurrent_jobs = 2              # Archives built at once per instance
max_queued_jobs = 64                 # Jobs waiting for a slot per instance; beyond it PUT is a 429
fetch_concurrency = 16               # Sources fetched ahead per archive (at most 256)
small_entry_bytes = 1048576          # Fetched and compressed whole below this; streamed above
max_entries = 1000000                # Per archive; also caps queued + running entries per instance
max_spec_bytes = 67108864            # Largest request body; larger ones are a 413
max_parsing_spec_bytes = 67108864    # Request bodies read, parsed and validated at once
max_archive_bytes = 1099511627776    # 1 TiB; requests may only lower it
max_wait_seconds = 30                # Longest ?wait=; lowered to stay below request_timeout_secs
job_retention_hours = 168            # Ended job records are deleted after this
heartbeat_seconds = 15               # Lease renewal interval (at most half of lease_seconds)
lease_seconds = 60
lease_skew_grace_seconds = 10        # Clock skew allowed before a silent runner counts as dead
shutdown_grace_seconds = 10          # How long SIGTERM waits for jobs to record their interruption
upload_memory_budget_bytes = 268435456  # Part buffers of all archives; [uploads] otherwise applies
# compression_parallelism = 8        # Blocks of one large entry deflated at once; default: CPU count
```

`max_wait_seconds` is capped at `request_timeout_secs - 5` (or half the timeout when that is 10
seconds or less), so a waiting request always answers before the request timeout cuts it off.

A queued job keeps its request in memory, about 110 bytes per entry plus its paths and keys; a
running one holds at most about 150 bytes per entry plus its paths, keys and source ETags (about
215 MiB for a million entries with short names). So the entries of all jobs queued or running on
one instance are capped at `max_concurrent_jobs * max_entries` (two million by default) as well as
by job count. One job of `max_entries` always fits on an idle instance.

Before that, the request body has to be read and parsed, and a parsed spec takes about three
times as much memory as its body. So an instance that already holds as many jobs or entries as it
may answers a `PUT` with a 429 before reading any of its body, unless the id names a queued,
running or completed job, which the request can only join. The bodies being read, parsed and
validated at once are capped at `max_parsing_spec_bytes` (never less than `max_spec_bytes`), so at
most about four times that in heap. A request takes its share with its `Content-Length` before
reading, or as its bytes arrive when it has none, and keeps it until its job holds a slot (and so
counts against the entry limit) or the spec is refused. A request that gets no share within 5
seconds is a 429 with `Retry-After: 1`. Parsing, validation and the spec hash run on the blocking
thread pool, so a large spec never holds up heartbeats or other requests.
Archives are built through the [ZIP job API](#zip-jobs).

### Backend Configuration

**Local filesystem:**
```toml
[backend]
type = "local"
root_path = "./data"
physical_bucket = "object-store-data"
```

**S3 and S3-compatible stores (MinIO, Ceph, SeaweedFS):**
```toml
[backend]
type = "s3"
region = "us-east-1"
physical_bucket = "my-bucket"
endpoint = "http://ceph.internal:7480"   # Optional; setting it switches to path-style addressing
public_endpoint = "https://s3.example.com" # Optional; host that signed URLs point at
force_path_style = true                    # Optional; defaults to true when `endpoint` is set
```

Credentials come from the standard AWS chain (environment, shared config, IRSA, instance roles), so
no keys need to live in the config.

**Google Cloud Storage:**
```toml
[backend]
type = "gcs"
physical_bucket = "my-gcs-bucket"
# endpoint = "http://fake-gcs:4443"        # Optional; emulator or private endpoint
# public_endpoint = "https://storage.example.com"
# credentials_file = "/etc/gcs/key.json"   # Optional service account key
```

Without `credentials_file` the service uses Application Default Credentials (GKE workload identity,
the metadata server, `GOOGLE_APPLICATION_CREDENTIALS`). Signed URLs are then produced keylessly
through the IAM `signBlob` API, so the service account needs `roles/iam.serviceAccountTokenCreator` on itself.

**Azure Blob Storage:**
```toml
[backend]
type = "azure"
account = "myaccount"
physical_bucket = "mycontainer"
# access_key = "..."            # Shared key; signed URLs use a service SAS
# connection_string = "..."     # Alternative to account/access_key (also for Azurite)
# endpoint = "http://azurite:10000/devstoreaccount1"
# public_endpoint = "https://myaccount.blob.example.com"
# auth = "default"              # access_key | default | workload_identity | managed_identity
```

Without an `access_key` the service authenticates keylessly (`default` tries workload identity,
managed identity and the Azure CLI in order) and signs URLs with a user-delegation SAS. The identity
needs the `Storage Blob Data Contributor` role plus permission to request a user delegation key
(`Storage Blob Delegator`). A user-delegation SAS cannot outlive its delegation key.

Upload URLs from Azure require the `x-ms-blob-type: BlockBlob` header. Every public URL response carries
a `headers` map (empty for backends that need none) that callers must send along with the request.

### Testing backends

`object-store-backends/tests/conformance.rs` runs one behavioural suite (etags, conditional writes
and races, ranges, copy, listing, multipart-sized uploads, signed URLs) against every backend.
`scripts/test-emulators.sh` starts SeaweedFS, Azurite and fake-gcs-server in docker and runs it.
Keyless authentication paths need a real cloud identity and are covered only by unit tests.

### Testing ZIP exports end to end

`object-store/tests/e2e_zip.rs` is a black-box suite: every test starts the real
`object-store-service` binary as separate processes with temporary config files and talks to them
only over HTTP. Each archive is downloaded, its size and SHA-256 matched against the job result,
and read back with the `zip` crate and with `unzip -t`, `zipinfo`, Python's `zipfile`, `ditto` and
`bsdtar` (whichever are installed). Every extraction must produce exactly the expected files.

```sh
# Fast part: local backend; cloud scenarios print SKIP lines (about a minute)
cargo test -p object-store --test e2e_zip -- --nocapture

# The same on SeaweedFS, Azurite and fake-gcs-server, plus the TypeScript client tests
./scripts/test-emulators.sh

# Heavy part: ZIP64 (4 GiB+ entries, 5 GiB archives, 70,000 and 1,000,000 entries) with the
# service's RSS sampled every 200 ms. Needs up to 30 GiB free disk; about 15 minutes.
cargo test --release -p object-store --test e2e_zip_heavy -- --ignored --nocapture --test-threads 1
```

`--nocapture` prints `[e2e]` lines with timings, sizes and memory. `OBJECT_STORE_E2E_BINARY` runs
another build of the service, and `OBJECT_STORE_E2E_LOG` sets its `RUST_LOG` (each instance logs to
a temp file whose tail is printed when a test fails). Lease tests that run two instances against
one store need conditional writes that are atomic across processes, so they only run on the
emulators. There at most three tests share an emulator at once, and the lease tests take theirs
alone, so the e2e stage takes about five minutes. Emulator containers are named after their ports,
and the script refuses to start while containers for its ports are running. To run two copies at
once, give the second one other ports with `OBJECT_STORE_TEST_S3_PORT`,
`OBJECT_STORE_TEST_AZURE_PORT` and `OBJECT_STORE_TEST_GCS_PORT`.

### Scale runs

`object-store/tests/zip_scale.rs` drives the archive pipeline in-process with generated sources and
an S3-like discarding sink, and counts every heap allocation: a 100 GiB archive of 10–20 GiB and
50,000 small entries (about 6 minutes), a 1,000,000-entry archive written to disk and checked with
Python's `zipfile` and `unzip -t` (under a minute, about 200 MiB of disk), and 16 multi-GiB
archives built next to 8 client uploads of 2 GiB (about 4 minutes).

```sh
cargo test --release -p object-store --test zip_scale -- --ignored --nocapture --test-threads 1
```

## API Reference

### Health Check

```
GET /health
```

Returns service health status.

### Buckets

**Create a bucket:**
```
POST /buckets
Content-Type: application/json

{
  "name": "my-bucket"
}
```

**List buckets:**
```
GET /buckets
```

**Delete a bucket:**
```
DELETE /buckets/{bucket}
```

### Objects

**Upload an object:**
```
PUT /buckets/{bucket}/objects/{key}
Content-Type: application/octet-stream
x-object-meta-author: john
x-object-meta-version: 1.0

[binary data]
```

Custom metadata headers must be prefixed with `x-object-meta-`.

**Download an object:**
```
GET /buckets/{bucket}/objects/{key}
```

**Download part of an object:** send a single `Range: bytes=start-end`, `bytes=start-` or `bytes=-length`
header. The backend reads only that range (`206 Partial Content` with `Content-Range`); a range outside
the object returns `416` with `Content-Range: bytes */size`. Malformed or multi-range headers, and any
`Range` sent with `If-Range`, are ignored and the whole object is returned. `GET` and `HEAD` responses
carry `Accept-Ranges: bytes`.
```
GET /buckets/{bucket}/objects/{key}
Range: bytes=0-4095
```

**Get object metadata:**
```
HEAD /buckets/{bucket}/objects/{key}
```

**Delete an object:**
```
DELETE /buckets/{bucket}/objects/{key}
```

**Delete many objects:**
```
POST /buckets/{bucket}/objects/delete
Content-Type: application/json

{"keys": ["folder/a.txt", "folder/b.txt"]}
```

Returns one result per requested key, so partial failures stay visible:

```json
{
  "results": [
    { "key": "folder/a.txt", "deleted": true, "error": null },
    { "key": "folder/b.txt", "deleted": false, "error": "..." }
  ],
  "deleted": 1,
  "failed": 1
}
```

Deleting a key that does not exist counts as deleted. Bucket marker keys
(`.bucket`) are rejected.

**Copy an object between logical buckets:**
```
POST /buckets/{bucket}/copy-object/{key}
Content-Type: application/json

{"source_bucket": "files", "source_key": "abc123"}
```

Copies into `{bucket}/{key}` from `source_bucket`/`source_key` and returns the
destination's object metadata. Both logical buckets live in the same physical
bucket, so S3 and GCS perform this server-side and the bytes never pass through
a caller. Other backends fall back to streaming the object through the service.
Bucket marker keys are rejected as destinations.

**List objects in a bucket:**
```
GET /buckets/{bucket}/objects?prefix=folder/&max_keys=100&continuation_token=...
```

Query parameters:
- `prefix` (optional): Filter objects by prefix
- `max_keys` (optional): Maximum number of results in this page
- `continuation_token` (optional): Token from a previous response's `next_continuation_token`

The response carries `next_continuation_token` whenever more objects remain.
Backends impose their own page limits (S3 caps a page at 1000 keys regardless of
`max_keys`), so a listing is only complete once `next_continuation_token` is
absent. The official clients loop over pages for you.

### ZIP jobs

A ZIP job builds one archive from stored objects (see [ZIP archives](#zip-archives)). Jobs are named
by the caller, idempotent, and stored in the backend under `.metadata/zip-jobs/`, so every
instance sharing the backend can answer for every job. Records are not reachable through the object
API.

| Request | Does | Answers |
| --- | --- | --- |
| `PUT /zip-jobs/{jobId}?wait=` | Creates the job or joins it | `200` ended, `202` queued or running |
| `GET /zip-jobs/{jobId}?wait=` | Reads the job | `200` ended, `202` queued or running, `404` |
| `DELETE /zip-jobs/{jobId}` | Cancels the job if it is active | `200` with the job, `404` |

Job ids are 1-128 characters of `A-Z a-z 0-9 . _ -` and may not start with a dot; anything else
(including `/`, `..` and percent-encoded separators) is a `400 invalid_job_id` and writes nothing.

**Create a job:**
```
PUT /zip-jobs/export-42?wait=20
Content-Type: application/json

{
  "destination": { "bucket": "exports", "key": "export-42.zip", "contentType": "application/zip" },
  "entries": [
    { "path": "README.md", "source": { "bucket": "files", "key": "abc123" } },
    { "path": "photos/cat.jpg", "source": { "bucket": "files", "key": "def456" },
      "compression": "store", "size": 52311, "crc32": 3735928559 }
  ],
  "deflateLevel": 6,
  "maxArchiveBytes": 1073741824
}
```

`compression` is `auto` (default), `store` or `deflate`; `size` and `crc32` are optional checks. The
spec is validated, and the destination bucket checked, before any record is written.

- A new id starts attempt 1.
- Repeating the PUT with the same spec while the job is queued, running or completed returns the
  job as it is.
- Repeating it after the job failed, was canceled or lost its runner starts the next attempt.
- The same id with a different spec is a `409 spec_conflict`.

**Job:**
```json
{
  "id": "export-42",
  "state": "completed",
  "attempt": 1,
  "specHash": "9f2c...",
  "owner": "5b0d7c1e-...",
  "progress": { "entriesTotal": 2, "entriesDone": 2, "bytesRead": 61502, "bytesWritten": 60110, "bytesEstimate": 61900 },
  "result": {
    "size": 60110,
    "sha256": "e3b0...",
    "etag": "\"7d1f...\"",
    "renamedEntries": [{ "path": "Readme.md", "archivePath": "Readme~2.md" }]
  },
  "error": null,
  "leaseExpiresAt": null,
  "createdAt": "2026-11-07T10:00:00Z",
  "updatedAt": "2026-11-07T10:00:03Z",
  "startedAt": "2026-11-07T10:00:00Z",
  "finishedAt": "2026-11-07T10:00:03Z"
}
```

`state` is `queued`, `running`, `completed`, `failed` or `canceled`. A failed or canceled job has
`error: { "code", "message", "retryable" }`. `owner` is the instance id running the attempt, and
`leaseExpiresAt` is set while the job is queued or running. `progress` is updated with every lease
renewal.

**Waiting.** `?wait=` holds a PUT or GET open for up to that many seconds (fractions allowed),
answering as soon as the job ends. Waits are capped at `max_wait_seconds`, and `wait` must be a
non-negative number (`400 invalid_request` otherwise). The instance running the job answers its
waiters the moment the job ends; other instances re-read the record about once a second, once for
all the requests waiting there for that job, and only while any are. A client
that disconnects does not affect the job, and starting or canceling a job finishes even if the
request is dropped.

**Errors.** A job that fails is still a `200` with `state: "failed"`. Refused requests are
`{"error": "...", "code": "..."}`:

| Status | Code | When |
| --- | --- | --- |
| 400 | `invalid_job_id` | Bad or missing job id |
| 400 | `invalid_request` | Bad `wait` |
| 400 | `invalid_spec`, `invalid_path`, `duplicate_path` | Malformed JSON, or a spec rejected before anything ran |
| 404 | `job_not_found` | No such job |
| 409 | `spec_conflict` | The id already has another spec |
| 409 | `job_id_conflict` | The backend stores this id and an existing one in one place (ids differing only in case on a case-insensitive local volume) |
| 413 | `spec_too_large` | Body over `max_spec_bytes` |
| 429 | `too_many_jobs` | `max_concurrent_jobs + max_queued_jobs` jobs, or `max_concurrent_jobs * max_entries` entries, already active here (`Retry-After: 5`); or no room under `max_parsing_spec_bytes` within 5 seconds (`Retry-After: 1`) |
| 503 | `shutting_down`, `contended` | Instance stopping, or record changing under heavy contention; `Retry-After: 1` |

A failed job's `error.code` says whether submitting the same spec again can help:

| Code | Retryable | Meaning |
| --- | --- | --- |
| `backend_error` | yes | Storage errors, including a failed final commit of the archive |
| `lease_expired` | yes | The runner stopped renewing its lease (crashed, stalled or partitioned) |
| `interrupted` | yes | The instance shut down while the job ran |
| `internal` | yes | Unexpected failure, including a panicking job task |
| `source_not_found`, `source_changed`, `crc_mismatch` | no | A source is missing or differs |
| `invalid_spec`, `invalid_path`, `duplicate_path`, `too_large` | no | The spec cannot produce an archive |
| `canceled` | no | `DELETE` was called (`state` is `canceled`) |

Because the archive is deterministic, re-submitting after a retryable failure produces the same
bytes and `sha256`.

**Leases and dead runners.** The instance that starts an attempt owns it and renews its lease every
`heartbeat_seconds`. Queued jobs hold a live lease too. Every record write is a compare-and-swap,
so an ended job never changes again and a runner that lost its lease cannot overwrite newer state.
A runner stops on its own as soon as a renewal fails or its lease runs out, and it renews the lease
again just before committing the archive. So a runner that was canceled, or that lost its lease,
never replaces the destination.

Any request that reads a job whose `leaseExpiresAt` plus `lease_skew_grace_seconds` has passed
records it as `failed` / `lease_expired`. A waiting request notices within about a second, and a PUT
then starts the next attempt on the instance that received it.

**Cancel.** `DELETE` records `canceled` at once. The runner stops immediately when it is on the
same instance, and otherwise at its next renewal or before committing, whichever comes first. The
upload is aborted, so an existing object at the destination is left untouched. Deleting an ended
job returns it unchanged.

**Shutdown.** On SIGTERM or SIGINT the instance stops accepting connections and stops its jobs. It
then waits up to `shutdown_grace_seconds` for them to record `failed` / `interrupted`, which also
answers their waiters. Any job still active after that is marked interrupted directly.

**Retention.** Every minute, each instance deletes up to 500 ended job records that are older than
`job_retention_hours`. Records whose runner died count as ended.

### Response Format

All JSON responses follow this structure:

**Success (Bucket):**
```json
{
  "name": "my-bucket",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Success (Object Metadata):**
```json
{
  "key": "path/to/file.txt",
  "size": 1024,
  "content_type": "text/plain",
  "etag": "abc123...",
  "last_modified": "2024-01-15T10:30:00Z",
  "metadata": {
    "author": "john",
    "version": "1.0"
  }
}
```

**Error:**
```json
{
  "error": "Bucket not found: my-bucket"
}
```

## Architecture

The service is organized into three main components:

- **object-store**: HTTP API layer and service logic
- **object-store-backends**: Storage backend implementations
- **clients**: Client libraries for different languages

## Client Libraries

Client libraries are available for multiple languages:

### Go

```bash
go get github.com/metorial/object-storage/clients/go
```

```go
import objectstorage "github.com/metorial/object-storage/clients/go"

client := objectstorage.NewClient("http://localhost:8080")
bucket, err := client.CreateBucket("my-bucket")
```

See [clients/go/README.md](clients/go/README.md) for full documentation.

### TypeScript/JavaScript

```bash
npm install @metorial/object-storage-client
```

```typescript
import { ObjectStorageClient } from '@metorial/object-storage-client';

const client = new ObjectStorageClient('http://localhost:8080');
const bucket = await client.createBucket('my-bucket');
```

See [clients/typescript/README.md](clients/typescript/README.md) for full documentation.

### Rust

```toml
[dependencies]
object-storage-client = "0.1"
```

See [clients/rust/README.md](clients/rust/README.md) for full documentation.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) file for details.
