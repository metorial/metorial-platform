# Shared libraries

Domain-free libraries used by products, platform services, frontends, and the enterprise layer.
The packages retain their `@lowerdeck/*` names and existing public contracts.

Packages live at `lib/<group>/<package>/`.

| Group           | Packages                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crypto`        | `api-key`, `encryption`, `jwt`, `sign`, `tokens`                                                                                                                             |
| `hashing`       | `hash`, `murmur3`                                                                                                                                                            |
| `ids`           | `id`, `shadow-id`, `snowflake`                                                                                                                                               |
| `encoding`      | `base62`, `canonicalize`, `serialize`                                                                                                                                        |
| `http`          | `api-mux`, `basic-rest`, `cors`, `forwarded-for`, `hono`, `join-paths`, `ssrf`, `websocket-client`                                                                           |
| `network`       | `anonymize-ip`, `ip-info`, `ip-range`                                                                                                                                        |
| `email`         | `email-domain-check`, `normalize-email`                                                                                                                                      |
| `jobs`          | `cron`, `queue`, `queue-checkpoint`, `retention-runner`                                                                                                                      |
| `events`        | `emitter`, `event`                                                                                                                                                           |
| `storage`       | `cache`, `prisma-pg`, `redis`                                                                                                                                                |
| `utils`         | `delay`, `lock`, `memo`, `once`, `programmable-promise`, `proxy`, `flatten`, `merge`, `patch`, `unique`, `case`, `slugify`, `random-from-array`, `random-number`, `timezone` |
| `framework`     | `error`, `pagination`, `presenter`, `service`, `validation`                                                                                                                  |
| `observability` | `execution-context`, `sentry`, `telemetry`                                                                                                                                   |
| `config`        | `env`                                                                                                                                                                        |
| `tooling`       | `offline`, `testing-tools`, `tsconfig`                                                                                                                                       |
| `rpc`           | Node `client`, `server`, and `signature`; shared `spec`; Go runtime and optional `otel` module                                                                               |

`utils` combines execution, data, text, random, and time helpers. Use a focused group for libraries
with a dedicated technical responsibility. Grouping changes placement; packages remain independently
consumable and may depend on packages in other groups.

Groups with implementations in multiple languages may add language directories. See the
[RPC layout](rpc/README.md), whose Node packages live at `rpc/node/` and whose shared spec package
lives at `rpc/spec/`.

Keep Metorial business concepts in their owning products or platform packages. New libraries
must follow the [OSS structure specification](../README.md).

From the OSS root, run the library tests with:

```sh
bunx turbo run test --concurrency=1 --filter='./src/lib/**'
```
