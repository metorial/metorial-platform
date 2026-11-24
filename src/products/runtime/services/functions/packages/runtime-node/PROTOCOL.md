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
| `crash` | `phase` (`boot` \| `runtime`), `requestId?`, `message`, `stack?` | Before exiting on a load failure or an uncaught exception; `requestId` is the request the exception was raised in, if any |

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

A crash message can carry one invocation's data, so in `shared` mode only the request named by
the crash frame's `requestId` receives it; the other in-flight requests get a generic message.
Exits without a crash frame (out of memory, `process.exit`) report the exit to every request.

In `shared` mode an unhandled promise rejection does not crash the worker: the request the
promise belongs to fails with `function_bay.unhandled_rejection` and the others keep running. A
rejection outside any request is only logged. `exclusive` mode keeps Node's default and crashes,
as on Lambda.

## Request context

The worker tracks the current request with `AsyncLocalStorage`; logs, lookups and tunnels are
attributed to it. A callback that lost its async context (a timer or queue created at load time,
for example) has no request in `shared` mode, so it can't log to a request or reach the network.
In `exclusive` mode it belongs to the request in flight, which keeps work queues created at load
time working. That includes work left over from a previous invocation: if it lost its context it
runs as the current invocation, with that invocation's egress grant and logs, as on Lambda.

## Connection pools

`fetch`, `http.globalAgent` and `https.globalAgent` route each request to its own pools, which
are destroyed when the request ends. Agents the function creates itself keep their pools, but
the request id is part of their pool key, so a keep-alive socket is only reused by the request
that opened it. If the function replaces the global `fetch` dispatcher, the worker puts the
routing dispatcher back before the next invocation and logs a warning to the instance log.

Clients that hold a socket themselves (a database client, a websocket kept at module level) are
not split up. When a request writes to a socket another request opened, the worker logs a
warning to the instance log, once per socket; the write still goes through.

## Trust model

Requests in one worker are separated against mistakes, not against the function's own code. Any
code in the bundle, including its dependencies, can read the other in-flight payloads and choose
the `requestId` of the tunnels it opens. `shared` mode is therefore only safe when every caller
trusts the function's code, as with platform-owned integrations.

## Tunnels (`METORIAL_SUPERVISOR_SOCKET`)

Each outbound TCP connection is a new connection to the unix socket. The first bytes are one
frame:

```json
{
  "type": "tunnel",
  "tunnelId": "<worker-chosen id>",
  "requestId": "req_…",
  "host": "api.example.com",
  "port": 443
}
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
