# Backend test CI

`setup-test-workspace` prunes the requested Turbo task graph into a separate runner
checkout, installs its frozen Bun lockfile, and restores complete hoisted installs
by exact dependency/configuration/lifecycle/runtime identity. Nested resolutions
omitted by Turbo pruning are restored from the source lockfile without resolving
new versions. Ordinary source and
test edits do not invalidate installs. Root enterprise install hooks are removed
only from the generated manifest. The source checkout remains intact.

Standalone `test` tasks use Warp Cache. Their prerequisite builds and Prisma
clients are restored through Turbo; `test:inputs` transit tasks invalidate results
when dependency source changes, even when that dependency has no test script.
Shared Horizon configuration and runtime identity are included explicitly.
`test:e2e` and `test:integration` are uncached.

Image jobs publish `test-image-<service>` artifacts containing `name`, immutable
GHCR `image`, and `sourceRevision`. E2E jobs consume those artifacts from the same
workflow run after all required image jobs succeed. The shared E2E action renders
CI Compose JSON from the local service definitions, removes all development build
recipes and source mounts, and substitutes exact image digests. Wrong revisions,
missing images, or mutable application references fail rather than rebuilding.

Tests run on the runner, with container endpoints translated to dynamically
allocated loopback ports.
Compiled workers use separate runtime databases; fixtures clean only isolated test
databases and a separate Redis database. Every pulled application receives HTTP and RPC create/get smoke checks.
Existing in-memory fixtures and mocks remain supported. Logs and volumes are
collected and cleaned on both success and failure.

Run `bun test src/tooling/test-ci/*.test.ts` after restoring the standalone test
prerequisites. Coverage includes dependency/runtime/configuration invalidation,
failed-task caching, install restoration, and unsafe image/Compose rejection.

### Affected test selection

`detect-test-changes` compares a PR with its merge base, or a push with its previous
revision. Enterprise submodule updates are expanded into OSS file changes. Unit tests
are selected through Turbo's task graph and resolved input patterns, including shared
configuration and transitive prerequisites. E2E selection includes workspace dependency
closures and all application containers used by each suite. Conduit is selected through
its workspace dependency closure and remains uncached.

Documentation and package README changes do not select tests. Root dependency/install
configuration, shared test tooling, and relevant workflow changes select all affected
categories conservatively. A manual workflow dispatch runs the complete test selection;
enterprise's explicit emergency `skip_tests` still takes precedence. Detection errors
fail the workflow rather than treating unknown changes as an empty selection. Image
publication remains independent of test selection so deployment aliases and the exact
artifacts required by selected E2E suites are always available.

### Control E2E groups

Each `control test:e2e` suite is split into `groups` matrix jobs (eight for OSS, four for
enterprise), each booting its own stack. Selected test packages are balanced by measured
seconds; unmeasured packages count as the median. A stack runs one test package at a time
(packages sharing a stack's worker starve each other's fixtures), so a package longer than
an even share of the total is split by test file into Vitest shards placed in different
groups. Each job passes its packages as control filters, followed by
`-- --package-shard=<pkg>=<i>/<n>`, which `metorial-e2e` turns into `--shard=<i>/<n>` for
that package only. To make a suite faster, raise `groups` rather than the stack's
`--concurrency`.

Durations come from two places. `.github/e2e-durations.json` is the committed baseline.
On top of it, every successful push run records what its groups measured: `control-e2e`
uploads each group's durations, the `Record E2E durations` job merges them into the Actions
cache, and `detect-test-changes` restores the latest copy as
`.github/e2e-durations.measured.json`, which takes precedence. Without a cache entry the
baseline alone is used.

Refresh the baseline from the output of a single complete run (shards of one package are
summed across all logs given):

```sh
bun src/tooling/test-ci/e2e-groups.ts update .github/e2e-durations.json <control-e2e.log>
```
