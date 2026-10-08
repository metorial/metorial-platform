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
