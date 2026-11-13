# Lowerdeck RPC protocol (v1)

This is the wire protocol spoken by `@lowerdeck/rpc-server`, `@lowerdeck/rpc-client` and the Go
runtime `ldrpc` (`oss/src/lowerdeck/go/ldrpc`). The TypeScript packages are the reference
implementation; where this document and the TypeScript code disagree, the code wins and this
document must be fixed.

The key words MUST, SHOULD and MAY are used as in RFC 2119.

Conformance is checked by:

- `oss/src/lowerdeck/go/ldrpc/testdata/vectors.json`: encodings and signatures produced by the
  TypeScript packages (regenerate with `bun interop/vectors.ts`), asserted by the Go unit tests.
- `oss/src/lowerdeck/go/ldrpc/interop/interop.test.ts`: the real TypeScript client against a Go
  server, and the Go client against a real TypeScript server.

---

## 1. Concepts

| Term        | Meaning                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------- |
| **Service** | One HTTP endpoint (the _mount path_, e.g. `https://bucket.internal/rpc`) exposing a set of methods. |
| **Method**  | A named procedure taking one input value and returning one output value.                            |
| **Call**    | One invocation of a method: `{ id, name, payload }`.                                                |
| **Request** | One HTTP request carrying one or more calls.                                                        |

There is no version negotiation, streaming, or server push. Every request is a `POST` and every
call gets exactly one result.

## 2. Method names

A method name is a list of segments joined by `:`, e.g. `bucket:get`, `bucket:files:list`.

- Segments SHOULD match `[A-Za-z][A-Za-z0-9_]*`. Segments MUST NOT contain `:`, `.` or `/`.
- Servers MUST treat `.` and `:` as equivalent separators (`bucket.get` ≡ `bucket:get`) and MUST
  report the canonical `:` form in responses.
- In URLs (direct calls, §5.2) the name is written with `.` separators: `/rpc/bucket.get`.

The TypeScript server derives names from the nested controller object (`{ bucket: { get } }` →
`bucket:get`). Generated Go services use the namespace path from the spec DSL the same way.

## 3. HTTP transport

| Aspect                            | Rule                                                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method                            | `POST`. A Go server answers anything else with `405 method_not_allowed`; the TypeScript server only special-cases `OPTIONS` for CORS.                                             |
| Request `Content-Type`            | Clients MUST send `application/rpc+json`. Servers MUST accept any value containing `application/rpc+json` or `application/json` and MUST reject others with `406 not_acceptable`. |
| Response `Content-Type`           | `application/rpc+json`.                                                                                                                                                           |
| Response header `metorial-req-id` | Server-generated request id (`req_…`). Opaque, for logs and support.                                                                                                              |
| Query string                      | Passed through to the server untouched and covered by signatures. The protocol assigns it no meaning.                                                                             |
| Body size                         | Unbounded in TypeScript. Go servers default to a 32 MiB limit and answer `413 payload_too_large` beyond it.                                                                       |
| Trace headers                     | Clients MAY send `traceparent`, `tracestate`, `baggage` and `sentry-trace`. Servers SHOULD continue the trace. They are not part of the protocol contract.                        |

## 4. Body encoding

Every request and response body is one JSON document in the **serialize envelope** produced by
`@lowerdeck/serialize`: SuperJSON output with its metadata stored under the reserved key
`$$TYPES$$`. This lets JavaScript `Date`, `bigint`, `Map`, `Set` and `undefined` survive JSON.

### 4.1 Envelope

```jsonc
{
  "$$TYPES$$": {
    "__mode": "object", // "object" | "value"
    "values": { "createdAt": ["Date"] }, // optional annotation tree (§4.3)
    "v": 1 // SuperJSON meta version, present when "values" is
  },
  // mode "object": the value's own keys are spread here
  "id": "bkt_1",
  "createdAt": "2026-01-02T03:04:05.006Z"
}
```

| Value being encoded                         | `__mode` | Document                                                                                                            |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| Non-empty object                            | `object` | The object's keys spread next to `$$TYPES$$`.                                                                       |
| Array                                       | `object` | `{ "items": [...], "$$MODE$$": "array_envelope" }` spread next to `$$TYPES$$`. Annotation paths start with `items`. |
| String, number, boolean, single `Date`, ... | `value`  | `{ "data": <value> }` next to `$$TYPES$$`.                                                                          |
| `null` (TypeScript)                         | `object` | Only `$$TYPES$$`: `{"$$TYPES$$":{"__mode":"object"}}`.                                                              |
| `{}` (TypeScript)                           | `object` | Identical to `null`. See §4.4.                                                                                      |
| `{}` (Go)                                   | `value`  | `{"$$TYPES$$":{"__mode":"value"},"data":{}}`. See §4.4.                                                             |

Decoding:

1. Parse the JSON. If it is not an object, or it has no `$$TYPES$$` object with a `__mode`, it
   is **plain JSON** and is used as-is. Decoders MUST accept plain JSON (some TypeScript error
   paths send it).
2. Remove `$$TYPES$$` and `$$MODE$$`. The value is the remaining object (`object` mode) or its
   `data` member (`value` mode).
3. Apply the annotation tree (§4.3) to the value.
4. If `$$MODE$$` was `array_envelope`, the result is the value's `items` member.

Reserved keys: an object whose top level has keys `$$TYPES$$` or `$$MODE$$` cannot be encoded.
Top-level objects with a `data` key are safe (they use `object` mode).

### 4.2 Scalars

| Type                                 | JSON form                                                                                      | Annotation                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| string, boolean, finite number, null | as JSON                                                                                        | none                                                  |
| `Date`                               | ISO-8601 UTC with milliseconds (`Date.prototype.toISOString`), e.g. `1970-01-01T00:00:00.000Z` | `Date`                                                |
| `bigint`                             | decimal string, e.g. `"10"`                                                                    | `bigint`                                              |
| `undefined` (object member)          | `null`                                                                                         | `undefined` (member is removed on decode)             |
| `NaN`, `Infinity`, `-Infinity`       | `"NaN"`, `"Infinity"`, `"-Infinity"`                                                           | `number`                                              |
| `Map`                                | array of `[key, value]` pairs                                                                  | `map`                                                 |
| `Set`                                | array                                                                                          | `set`                                                 |
| `RegExp`, `URL`, `Error`             | string / string / `{name, message}`                                                            | `regexp` / `URL` / `Error`                            |
| typed array, class, custom, symbol   | as SuperJSON emits them                                                                        | `["typed-array", "Uint8Array"]`, `["class", name]`, … |

Plain JSON numbers are IEEE-754 doubles on the TypeScript side. Integers outside ±2^53−1 lose
precision; use `bigint` (or a string) for them.

### 4.3 Annotation tree

`$$TYPES$$.values` describes which JSON values need type restoration. It has two shapes:

- **Root form** — an array `[annotation, children?]` that applies to the value itself
  (e.g. a top-level `Date`: `"values": ["Date"]`).
- **Children form** — an object mapping _paths_ (relative to the current node) to trees:
  `{ "createdAt": ["Date"], "items.0.at": ["Date"] }`.

A tree is `[annotation]` or `[annotation, { relativePath: tree, ... }]`. An annotation is a
string (`"Date"`) or an array (`["class", "Foo"]`).

Paths are segments joined by `.`; inside a segment, `\` is escaped as `\\` and `.` as `\.`.
Object members are addressed by key, array elements by decimal index. Example: the key `a.b`
inside `x` is `x.a\.b`.

Children are applied **before** the node's own annotation: a `map` annotation restructures its
value, and its child paths address the original `[[key, value], ...]` layout (`m.0.1` is the
value of the first entry of map `m`):

```json
{ "m": ["map", { "0.1": ["Date"] }] }
```

Required decoder support:

| Annotation  | TypeScript        | Go (`ldrpc`)                                               |
| ----------- | ----------------- | ---------------------------------------------------------- |
| `Date`      | `Date` object     | stays an ISO string; decodes into `time.Time`              |
| `undefined` | `undefined`       | member removed (array element → `null`)                    |
| `bigint`    | `bigint`          | JSON number literal (decode into `int64` or `json.Number`) |
| `map`       | `Map`             | JSON object; non-string keys are rejected                  |
| `set`       | `Set`             | JSON array                                                 |
| `number`    | `NaN`/`±Infinity` | rejected (decode error)                                    |
| others      | restored          | value kept in its JSON form                                |

Go encoders annotate `time.Time` as `Date` and non-finite floats as `number`; they never emit
`bigint`, `map`, `set` or `undefined`.

### 4.4 `null` versus `{}`

TypeScript encodes `null` and `{}` identically (`{"$$TYPES$$":{"__mode":"object"}}`), and
`@lowerdeck/rpc-client` decodes that document as `null`. Consequences:

- A TypeScript method that returns `{}` is seen by TypeScript clients as `null`.
- Go servers encode an empty object in `value` mode (`{"data":{}}`), which every decoder reads as
  `{}`, and encode `nil` as the bare document, which TypeScript reads as `null`.
- Go decoders read the bare document as `{}` (it is a valid input object and unmarshals into a
  struct; into a pointer it yields a zero value, not `nil`).
- Specs SHOULD make method inputs and outputs objects (or void), never top-level nullable values.

## 5. Requests

A request is either a **batch** or a **direct call**. Clients choose; servers MUST accept both.

### 5.1 Batch

`POST <mount path>` with the body:

```jsonc
{
  "$$TYPES$$": { "__mode": "object", "values": { "calls.0.payload.since": ["Date"] }, "v": 1 },
  "calls": [
    { "id": "call_k2j4h5_1", "name": "bucket:get", "payload": { "bucketId": "bkt_1" } },
    {
      "id": "call_k2j4h5_2",
      "name": "bucket:list",
      "payload": { "since": "2026-01-01T00:00:00.000Z" }
    }
  ]
}
```

- `id`: string chosen by the client, unique within the request; echoed back. Opaque.
- `name`: method name (§2).
- `payload`: the method input. MAY be absent (treated as `undefined`/`null`).
- The whole body is **one** envelope: annotation paths start at the batch root
  (`calls.<i>.payload.…`).
- The TypeScript client sorts calls by name; order carries no meaning.

A batch with one call is the default form used by both clients when batching is not active.

### 5.2 Direct call

`POST <mount path>/<name with . separators>` with the input as the entire body:

```
POST /rpc/bucket.get
{"$$TYPES$$":{"__mode":"object"},"bucketId":"bkt_1"}
```

The final path segment MAY be prefixed with `$` (`/rpc/$bucket.get`); servers strip it.

### 5.3 Telling them apart

Servers MUST classify the decoded body first and only then look at the path:

1. If the decoded body is an object whose `calls` member is an array of objects that each have
   a string `id` and a string `name`, it is a **batch**, whatever the URL.
2. Otherwise, if the path is exactly `<mount path>/<segment>`, it is a **direct call** of
   method `<segment>`. (A TypeScript server mounted at the root treats the last path segment of
   any URL as the method name; so does a Go server with an empty `Path`.)
3. Otherwise the request is rejected with `406` and a `validationError` (entity
   `request_data`) body.

Because of rule 1, **a method input must never have the shape of a batch envelope** (a top-level
`calls` array of `{id, name}` objects). The spec compiler (see `go-services-plan.md`) rejects
inputs with a top-level `calls` field.

## 6. Responses

### 6.1 Batch response

```jsonc
{
  "$$TYPES$$": {
    "__mode": "object",
    "values": { "calls.0.result.createdAt": ["Date"] },
    "v": 1
  },
  "__typename": "rpc.response",
  "calls": [
    {
      "__typename": "rpc.response.call",
      "id": "call_k2j4h5_1",
      "name": "bucket:get",
      "status": 200,
      "result": { "id": "bkt_1", "createdAt": "2026-01-02T03:04:05.006Z" }
    },
    {
      "__typename": "rpc.response.call",
      "id": "call_k2j4h5_2",
      "name": "bucket:list",
      "status": 404,
      "result": {
        "object": "error",
        "ok": false,
        "status": 404,
        "code": "not_found",
        "...": "..."
      }
    }
  ]
}
```

- Every call in the request gets exactly one entry, matched by `id`. Entry order is not
  significant (the TypeScript server groups entries by internal sub-server).
- `status` is an HTTP-style status code for that call: `200` on success, the error's `status`
  otherwise. `result` is the method output or an error body (§7).
- The **HTTP status** of the response is the maximum of `200` and all call statuses. Clients
  MUST read per-call statuses and MUST NOT treat a non-2xx HTTP status as failure of every call
  when the body is a batch response.

### 6.2 Direct response

The body is the method output (on success) or an error body (§7), with the call's status as
the HTTP status.

### 6.3 Request-level failures

These fail the whole request before (or instead of) running calls. The body is a single error
(§7), not a batch response:

| Condition                                          | HTTP status                 | Error                                                                 |
| -------------------------------------------------- | --------------------------- | --------------------------------------------------------------------- |
| Wrong `Content-Type`                               | 406                         | `not_acceptable`, message `Content-Type must be application/rpc+json` |
| Body unreadable or not JSON / not a valid envelope | 406                         | `not_acceptable`, message `Invalid JSON`                              |
| Body too large (Go only)                           | 413                         | `payload_too_large`                                                   |
| Authentication failed (§8)                         | 401 (or the error's status) | `unauthorized`                                                        |
| Neither batch nor direct call (§5.3)               | 406                         | `invalid_data`, entity `request_data`                                 |
| **Any** call names an unknown method               | 404                         | `not_found`, entity `handler` — no call runs                          |
| Unexpected server failure                          | 500                         | `internal_server_error`                                               |

Clients detect a request-level error by a top-level body where `__typename == "error"` or
(`object == "error"` and `ok == false`), and fail every call in the request with it.

## 7. Errors

An error body is the JSON form of a `@lowerdeck/error` `ServiceError`:

```json
{
  "object": "error",
  "ok": false,
  "status": 404,
  "code": "not_found",
  "message": "The requested bucket could not be found.",
  "hint": "Make sure the resource you are trying to access exists, ...",
  "entity": "bucket",
  "id": "bkt_1"
}
```

| Field                           | Required | Meaning                                                                 |
| ------------------------------- | -------- | ----------------------------------------------------------------------- |
| `object`, `ok`                  | yes      | Always `"error"` and `false`.                                           |
| `status`                        | yes      | HTTP-style status, 400–599.                                             |
| `code`                          | yes      | Stable machine-readable `snake_case` code. Clients branch on this.      |
| `message`                       | yes      | Human-readable, safe to show.                                           |
| `hint`, `description`, `reason` | no       | Optional human-readable detail.                                         |
| anything else                   | no       | Error-specific data (`entity`, `id`, `errors`, ...). Must be JSON-safe. |

Standard codes (from `@lowerdeck/error`, mirrored in `ldrpc`):

| Status | Code                    | Notes                                                                                 |
| ------ | ----------------------- | ------------------------------------------------------------------------------------- |
| 400    | `invalid_data`          | Input validation failed. Carries `entity` and `errors` (below).                       |
| 400    | `bad_request`           |                                                                                       |
| 401    | `unauthorized`          |                                                                                       |
| 402    | `payment_required`      |                                                                                       |
| 403    | `forbidden`             |                                                                                       |
| 404    | `not_found`             | Carries `entity` and optionally `id`.                                                 |
| 405    | `method_not_allowed`    |                                                                                       |
| 406    | `not_acceptable`        |                                                                                       |
| 409    | `conflict`              |                                                                                       |
| 410    | `gone`                  |                                                                                       |
| 412    | `precondition_failed`   |                                                                                       |
| 429    | `too_many_requests`     |                                                                                       |
| 500    | `internal_server_error` | Servers MUST NOT put internal details (messages, stacks) in 5xx bodies in production. |
| 501    | `not_implemented`       |                                                                                       |
| 504    | `timeout`               | Also produced locally by clients when a call's deadline passes.                       |

Services define additional codes (e.g. `bucket_archived`). Spec-declared errors (see the plan)
become typed constructors on the server and typed codes on clients.

Validation errors (`invalid_data`) carry the `@lowerdeck/validation` issue list:

```json
{
  "object": "error",
  "ok": false,
  "status": 400,
  "code": "invalid_data",
  "message": "The provided data is invalid.",
  "hint": "Make sure the data you are sending follows the specification outlined in the documentation.",
  "entity": "call_data",
  "errors": [
    {
      "code": "invalid_type",
      "message": "Invalid input, expected string, received number",
      "expected": "string",
      "received": "number",
      "path": ["bucketId"]
    }
  ]
}
```

`entity` is `call_data` for a call whose payload failed validation and `request_data` for a
malformed request (§5.3).

## 8. Authentication

A server uses at most one scheme. All signature schemes use the request header
`metorial-rpc-signature` and sign the **exact body bytes sent** and the URL's path and query
(`pathname + search`, i.e. the escaped path, plus `?query` when non-empty). Proxies MUST NOT
re-encode bodies or rewrite paths between a signing client and a verifying server.

Verification failures produce `401 unauthorized` for the whole request.

### 8.1 None

Network-level isolation only.

### 8.2 HMAC (`v1`)

Shared secret between caller and service.

```
metorial-rpc-signature: t=<unix ms>,v1=<hex HMAC-SHA256(secret, canonical)>
```

Canonical string (lines joined by `\n`, no trailing newline):

```
v1
<t>
POST
<path + query>
<body>
```

The server rejects the request if `|now − t| > 60 s`, if the header is malformed (`t` not
digits, `v1` not 64 hex chars), or if the HMAC differs (constant-time comparison).

### 8.3 Ed25519 (`ed25519-v1`)

Per-caller key pairs; the server knows callers' public keys by key id.

```
metorial-rpc-signature: version=ed25519-v1,alg=ed25519,kid=<key id>,aud=<audience>,t=<unix ms>,nonce=<nonce>,sig=<signature>
```

- `kid`, `aud`: `[A-Za-z0-9_.:/-]{1,256}`. `aud` names the receiving service; servers MUST
  reject other audiences.
- `nonce`: 24 random bytes, base64url without padding (32 chars).
- `sig`: Ed25519 signature, base64url without padding (86 chars), over the UTF-8 bytes of
  `JSON.stringify` of:

  ```json
  ["ed25519-v1", "<kid>", "<aud>", <t as number>, "<nonce>", "POST", "<path + query>",
   "<base64url(sha256(Authorization header or ''))>", "<base64url(sha256(body))>"]
  ```

  Implementations MUST serialize exactly like `JSON.stringify` (no HTML escaping, no spaces).

- Exactly the seven listed header fields, no duplicates, header ≤ 2048 bytes.
- The server rejects `|now − t| > 60 s`. Nonces are not tracked; replay protection is the time
  window only.
- Keys are exchanged as JWK (`{"kty":"OKP","crv":"Ed25519","x":…,"d":…}`).

### 8.4 Custom

Servers MAY instead authenticate with any function of the request and raw body (the TypeScript
`authenticateRequest` option, Go `ServerOptions.Authenticate`). Its result is exposed to
handlers as request context.

## 9. Client behavior

Clients are not required to retry, but the reference clients do, and services must be written
with that in mind: **a call may be executed more than once.** Make methods idempotent, or make
duplicate execution harmless.

| Failure                                                                                                             | Retried?                                                          |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Call or request error with status `< 500`                                                                           | Never.                                                            |
| Call error with status `>= 500`                                                                                     | Up to a bounded number of attempts (6 on servers, 3 in browsers). |
| Transport failure (connection refused/reset, DNS) or an undecodable `5xx` body (a proxy or load balancer answering) | Until the deadline (servers); bounded in browsers.                |
| Undecodable non-5xx body                                                                                            | Bounded attempts.                                                 |

- Backoff between attempts: `min(attempt × 20 ms, 1 s)` on servers (`attempt × 1 s` in browsers).
- Deadline: 2 minutes per call on servers by default, covering all attempts; exceeding it
  yields a local `504 timeout` error.
- A retry re-signs the request (fresh timestamp and nonce).
- The TypeScript client coalesces calls made within 10 ms into one batch **in browsers only**;
  on servers every call is its own one-call batch. The Go client batches only through its
  explicit `Batch` API and does not retry individual calls of a batch.

## 10. Implementation notes

| Behavior                       | TypeScript                                                   | Go (`ldrpc`)                                                                |
| ------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Non-`POST` methods             | `OPTIONS` handled for CORS; others processed                 | `405`                                                                       |
| CORS                           | Built in (`rpcMux` `cors` option)                            | Not built in; wrap the handler if a browser must call a Go service directly |
| Body size limit                | None                                                         | 32 MiB default (`413`)                                                      |
| Client IP                      | `cf-connecting-ip` → `x-forwarded-for` (first) → `x-real-ip` | same, then the socket address                                               |
| Empty object output            | Encoded like `null` (§4.4)                                   | `value` mode, stays `{}`                                                    |
| Datetime precision             | milliseconds                                                 | milliseconds on the wire (`time.Time` is truncated)                         |
| Panics / unexpected exceptions | `500 internal_server_error`                                  | same; reported to `OnError`                                                 |
