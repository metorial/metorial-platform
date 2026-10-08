# Backend image reuse

The `image-cache` composite action computes a `build-v2-<sha256>` tag before any
Docker build or dependency installation. It resolves that tag in the destination
GHCR repository and then in the canonical OSS repository from `services.json`.
The registry is the index; no previous branch or commit is assumed to be equivalent.

Pruned services hash workspace-relative Git blob IDs and modes selected by a
versioned input descriptor, exact pruned manifests/lockfiles, generated manifest
replacements, and direct Docker `COPY` inputs. Modified tracked files are hashed
from the working tree; staged additions and deletions are included. The descriptor
preserves task-only dependencies, workspace overrides, and partial runtime assets.
Other services hash direct `COPY` inputs. Dockerfiles, output-affecting arguments,
resolver/prune tooling, and pinned external image digests also determine identity.
Commit IDs, branches, credentials, descriptor lookup keys, and registry destinations
are excluded. External images are pinned in the generated Dockerfile used for
both dependency and final builds.

`services.json` records OSS images and their build recipes. Turbo tasks are read
from each Dockerfile's prune command to keep fingerprinting and builds aligned.
Enterprise runs shared services with `workspace: ./oss`, giving exactly the same
inputs as OSS. Enterprise services use their own workspace and Dockerfiles; pass
all output-affecting build arguments through `build-arguments` as JSON. Credentials
for caching and Sentry upload are excluded. Unsupported dynamic external image
references or direct COPY inputs fail rather than silently produce unsafe keys.

Descriptors are restored from GitHub Actions cache first and from an immutable
GHCR artifact second (`descriptor-image-descriptor-v1-<sha256>`). Trusted runs
publish descriptor artifacts in their image repository; canonical OSS artifacts
are read-only fallbacks. Artifacts are validated as data, including their expected
key and safe paths. Keys cover manifests, complete locks, Turbo/task/prune
configuration, and additional file inventories needed by pruning. Workflow edits
and lifecycle source edits do not invalidate descriptors.

A descriptor hit performs no Turbo command and copies no source before image
lookup. On an image miss, it materializes the build context once. Descriptor misses
run normal discovery/pruning once and retain that context. The `prepared` action
output lets `prune-docker` reuse it without a second prune. Dependency layer caches
continue to work. Whole locks invalidate descriptors, but image identity includes
only the exact pruned lock: unrelated resolutions do not invalidate images.

The version change deliberately causes initial image-cache misses. Existing
SHA/branch/deployment aliases and registry-copy verification remain compatible.

On a hit, skip dependency-cache restoration, Warp Cache startup, and Docker setup.
Use `image-cache.ts copy SOURCE TARGETS` to copy by digest and verify destination
digests. It preserves the complete OCI image, including platform manifests. Builds
publish the fingerprint tag and existing aliases to GHCR. Trusted same-repository
PRs may publish to GHCR; fork PRs can reuse anonymously accessible images and otherwise build without
publishing or privileged cache access. Inaccessible anonymous lookups are reported
explicitly; authenticated lookups still fail on authorization errors.
Enterprise non-PR deployment runs promote the GHCR image and aliases to ECR before
allowing deployment. Tests still run even when image builds are skipped.

Registry authorization errors are fatal. For a trusted publisher, a denied lookup
on its own destination first attempts to publish a reserved empty OCI index
(`cache-bootstrap-v1`). This initializes a new GHCR package and proves write
access; a denied initialization still fails. Canonical OSS lookups never initialize
packages. Missing manifests cause a build; transient
errors retry. Deleting a fingerprint image is safe and results in a cold build.
Mutable external base tags are resolved on every run, so base updates invalidate
reuse. Existing SHA tags without a fingerprint are not assumed safe to reuse.

Run `bun test src/tooling/docker-build/image-cache.test.ts` for fingerprint and
registry-failure regression coverage. For local registry experiments, install the
pinned regctl version from the action, configure the local registry's TLS setting,
and pass the same local repository as both destination and canonical arguments.
