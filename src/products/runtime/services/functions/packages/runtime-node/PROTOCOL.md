# Supervisor ↔ worker protocol

The language-neutral contract between the Go supervisor
(`services/cluster-manager/supervisor`) and a language worker such as this package's
`bootstrap.cjs` (PLAN.md 7.6, 8.4). A runtime for another language implements the worker side of
this document plus the interception contract in PLAN.md 8.4.

## Process

The supervisor starts the worker as `node --max-old-space-size=<85% of memory> /opt/runtime/bootstrap.cjs`
in the bundle directory, in its own process group, with:

| Variable | Meaning |
|---|---|
| `METORIAL_CONTROL_FD` | File descriptor of the control channel (always `3`) |
| `METORIAL_SUPERVISOR_SOCKET` | Unix socket path for egress tunnels |
| `METORIAL_ENTRYPOINT` | JSON `{ path, export, kind: "module" \| "enveloped" }` |
| `METORIAL_CONCURRENCY` | `exclusive` or `shared` |
| `METORIAL_BUNDLE_DIR` | Unpacked bundle |
| `METORIAL_FUNCTION_ID`, `METORIAL_FUNCTION_VERSION_ID`, `METORIAL_EXECUTION_ENV`, `METORIAL_RUNTIME`, `METORIAL_TIMEOUT_SECONDS`, `METORIAL_MEMORY_MB` | Informational |

The worker removes the first five from its environment before loading user code. The rest of the
environment is the function's own, with reserved names (`NODE_OPTIONS`, `NODE_PATH`,
`NODE_EXTRA_CA_CERTS`, `PORT`, `K_*` Knative names, and the `LD_`, `METORIAL_`, `CLUSTER_MANAGER_`,
`EGRESS_GATEWAY_`, `KUBERNETES_` prefixes) stripped by the supervisor.

The worker's stdout and stderr are instance logs: the supervisor forwards each line to the pod's
stdout as JSON without a `requestId`.

## Framing

Every frame is a 4-byte big-endian length followed by that many bytes of UTF-8 JSON. Frames are at
most 64 MiB and always carry `type`. Unknown fields are ignored.

## Control channel (fd 3, a socketpair)

Worker → supervisor:

| Frame | Fields | When |
|---|---|---|
| `ready` | – | Interception is installed and the entrypoint loaded. `/ready` passes only after this. |
| `result` | `requestId`, `payload` (any JSON; the `{ statusCode, body }` envelope) | Once per `invoke`, after all of the request's `log` frames |
| `log` | `requestId`, `ts` (ms since epoch), `stream` (`stdout` \| `stderr`), `line` (no newline) | Each line written inside a request's context |
| `lookup` | `id`, `requestId`, `hostname` | `dns.lookup` inside a request |
| `crash` | `phase` (`boot` \| `runtime`), `message`, `stack?` | Before exiting on a load failure or an uncaught exception |

Supervisor → worker:

| Frame | Fields | Meaning |
|---|---|---|
| `invoke` | `requestId`, `payload` (the exact `payloadJson` string), `context { invocationId, deadlineMs }` | Run the handler once |
| `cancel` | `requestId` | Shared-mode timeout: drop the request, destroy its pools; a later result is ignored |
| `lookupResult` | `id`, `addresses[]` or `error { code, message }` | Answer to `lookup`; an empty list means not found |
| `tunnelError` | `tunnelId`, `error { code, message, status?, reason? }` | A tunnel was refused; destroy that socket with the error |
| `tunnelReady` | `tunnelId` | The gateway reached the destination; only now does the socket emit `connect` |

A `crash` with `phase: boot` before `ready` puts the supervisor in the boot-failed state: `/ready`
passes and every invocation answers `function_bay.boot_error` with `bootError: true`, without
restarting. Any other exit fails the in-flight requests with `function_bay.crash` and restarts the
worker with backoff; five crashes within five minutes fail readiness for good. A worker exits
when the control channel closes.

## Tunnels (`METORIAL_SUPERVISOR_SOCKET`)

Each outbound TCP connection is a new connection to the unix socket. The first bytes are one
frame:

```json
{ "type": "tunnel", "tunnelId": "<worker-chosen id>", "requestId": "req_…", "host": "api.example.com", "port": 443 }
```

followed by the raw byte stream in both directions; TLS stays end to end inside it. `host` is
passed unresolved. Half-close is propagated both ways.

The supervisor opens an HTTP/2 `CONNECT host:port` stream to the egress gateway with the request's
grant. When the gateway accepts, it sends `tunnelReady`; the worker holds the socket's `connect`
event until then, so a refused destination never looks connected. If the request is unknown or
finished, or the gateway refuses, it sends `tunnelError` on
the control channel and keeps the unix connection open until the worker closes it (5 s at most),
so the worker reports the gateway's reason rather than a bare reset. When a request ends, all of
its tunnels are closed.

## Timeouts

The supervisor owns deadlines (`min(deadlineMs, METORIAL_TIMEOUT_SECONDS)`). In `exclusive` mode
it kills the worker's process group on timeout and starts a new worker; in `shared` mode it sends
`cancel` and keeps the worker.
