# Public pricing extraction

The catalog refreshes prices from 17 public provider sources without API keys. Run checks from
this package:

```sh
bun run typecheck
bun run test
bun run test:pricing-live
```

`test:pricing-live` fetches every provider, including the model pages linked by Mistral's index.
Ordinary tests use small fixtures and never require provider credentials.

## Sources

`src/sources/providers.ts` registers each source's URL, fetcher, parser, and destination vendor.
Each provider owns `src/sources/<provider>/index.ts`, `index.test.ts`, and `fixtures/`.
Provider-specific parsing and regression tests belong in that folder. Shared validation and
cross-provider contract tests stay outside it.

| Format                         | Providers                                                           |
| ------------------------------ | ------------------------------------------------------------------- |
| JSON                           | Cerebras, DeepInfra, Novita, Hugging Face, LLM Gateway, Venice      |
| Markdown                       | OpenAI, Anthropic, Together, xAI, Z.ai, Fireworks, Groq, Perplexity |
| Markdown index and model pages | Mistral                                                             |
| HTML tables                    | DeepSeek                                                            |
| Markdoc tables                 | Google AI Studio / Gemini Developer API                             |

Google prices apply to the paid Standard tier. The parser selects date-qualified prices using
the build's `now` value, records their expiry in `validUntil`, and separates token rates from
cache storage charges. These prices are scoped to `google-ai-studio`, independently of Vertex AI.

## Failure behavior

`extractData` in `src/lib/extraction.ts` collects records and diagnostics:

- `add(record)` collects a record.
- `row(label, fn)` collects an extraction error with its row label.
- `flag(problem)` marks the extraction invalid.
- `abort(problem)` immediately throws `ExtractionError`.
- `skip(reason)` records a known exclusion in the build's `sourceIssues`.

Any error, explicit flag, or empty extraction aborts without returning partial results.
`requirePrices` also rejects invalid identifiers, negative or nonfinite prices, conflicting
duplicates, invalid billing units, and unordered context tiers.

An `ExtractionError` propagates through catalog building, including when a previous snapshot
exists. Network failures can use a previous snapshot after parsing and validating it; its source
status is `fallback`. Offline and pinned builds validate snapshots through the same parsers.
Raw documents are saved under `sources/<kind>.json` by the existing catalog emitter.

## Price matching and conditions

Token prices are normalized to USD per million tokens. Unit prices retain an explicit unit,
including minutes, hours, characters, images, pages, and token-hours.

Sources update existing offerings within the matching vendor, endpoint, and serving tier.
Pricing documents never add or retire offerings. OpenAI snapshot IDs require an exact match;
Anthropic's published family prices can match dated releases of that family.

`Pricing.conditions` preserves rates that depend on additional conditions. DeepSeek's peak and
off-peak entries carry the published scheduling policy, including holiday exceptions. An unpinned
Hugging Face route carries each provider's rates. Such records have no unconditional token rate;
consumers must resolve the condition before calculating a cost. Gateway prices remain scoped to
their gateway offerings.

Known exclusions are reported rather than guessed: negotiated prices, unpriced routes, and some
image/video prices requiring resolution, quality, step, or multimodal billing configuration.
Fireworks' regional and speed variants are excluded from its standard model rows; its Priority
column produces separately scoped prices. Existing catalog data remains available for offerings
without a matching extracted price.

## Adding a source

Register its fetcher and parser in `pricingSources`, add its `SourceKind`, and add a representative
fixture and tests under `src/sources/<provider>/`. Add assertions for its units, tiers, aliases, or
date rules. Shared tests exercise snapshot replay and abort propagation for every registered
source. Run the live suite against the actual public feed.

## Automatic format repairs

The reconciler starts a repair session only for sources that raised an extraction error and have
a captured response. The agent can edit implementation, tests, and fixtures inside that provider's
folder. Other providers, shared helpers, registry, dependencies, and framework tests remain read-only.
The edit/write tools check paths, including symlinks and hardlinks; an OS sandbox also restricts
writes from the agent and its test subprocesses. Session state and temporary files use a separate
scratch directory. Linux requires Bubblewrap; macOS uses `sandbox-exec`. Repairs abort if sandboxing
is unavailable.

The agent must run the `test` tool before completing its session. Its fixed suites are `provider`,
`typecheck`, and `all`. The host then independently runs the provider tests, typechecking, the full
catalog suite, and replay of the failed response. Parser replay also runs in a sandbox.

Failed verification resumes the same agent session with the current files and failure output.
After three attempts, the reconciler restores all provider folders changed by that repair batch
and aborts. Accepted changes are recorded in `source-repairs.json`; only those files are included
with the override changes in the reconciler's branch and pull request.
