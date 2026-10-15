# API client generation

Run `bun src/index.ts <api-url> <output-folder> <language> [snapshot-file] [mapper-options]`.
The optional snapshot bypasses API requests and makes regeneration reproducible across clients.
Its shape is `{ "versions": { "versions": [...] }, "endpoints": { "<version>": { "endpoints":
[...], "controllers": [...], "types": [...] } } }`, containing unmodified introspection responses.
Keep snapshots outside source control because they can contain private endpoint metadata.

TypeScript uses `@metorial/util-resource-mapper/compact` from runtime version 3.2.0 or newer.
Build that package before building clients. Python and Go mapper formats remain unchanged.
Run generator regressions with `bun test src/languages/typescript/*.test.ts`.

## Mapper patterns

TypeScript enables scoped `_at` date defaults and the generic pattern registry. The registry
lives in `src/languages/typescript/patterns.ts`: each entry has a stable descriptor ID, explicit
priority, schema-aware matcher, encoder, and canonical expansion. Children are optimized before
parents. Only effective transformation fields participate in matching; incompatible schemas and
additional transformations retain the normal descriptors. Raw records and arbitrary JSON are
never recursively transformed. Non-date `_at` fields receive explicit identity overrides.

Pass `--mapper-patterns=none` to disable special descriptors, or select IDs with
`--mapper-patterns=5,6,7,8`. Pass `--mapper-date-defaults=off` to disable date shorthand.
Combining both disabled options reproduces the previous compact format. Options follow the
language and optional snapshot-file arguments and affect only TypeScript mappers.

Add patterns only with runtime support, equivalence tests, measured frequency, and a bundle
comparison including interpreter overhead. Domain-specific shapes and identity-only query
controls are deliberately not registered. See [the pattern measurements](./MAPPER_PATTERN_BENCHMARK.md)
for isolated and combined comparisons, including small compression tradeoffs.

## Benchmarking

Run `bun run benchmark:mapper-patterns <workspace> [report.json]` after building the runtime.
The workspace contains `baseline/clients`, `baseline-runtime` (the previous runtime's built
files), and `variants/<variant>/clients`, regenerated from the same snapshot. Each client folder
contains `metorial-dashboard/src/gen`, `metorial-consumer/src/gen`, and `metorial-node/sdk/gen`.

Variant names are `disabled`, `dates`, `date-filter`, `pagination`, `lists`, `timestamps`,
`without-filters`, `without-pagination`, `without-lists`, `without-timestamps`, and `all`.
Individual patterns disable date defaults; `disabled` also disables patterns. `without-*`
variants enable dates and all patterns except the named one. The benchmark reports emitted
pattern counts, full generated-client sizes, and warmed initialization/transformation timings.
It checks compressed aggregate savings and a 256-byte per-client compression regression budget.
