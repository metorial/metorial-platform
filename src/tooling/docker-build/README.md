# Backend image reuse

The `image-cache` composite action computes a `build-v1-<sha256>` tag before any
Docker build or dependency installation. It resolves that tag in the destination
GHCR repository and then in the canonical OSS repository from `services.json`.
The registry is the index; no previous branch or commit is assumed to be equivalent.

Pruned services hash the actual `out/json` and `out/full` trees, plus direct Docker
`COPY` inputs outside the pruned context. Other services hash their direct `COPY`
inputs. File contents, executable permissions, Dockerfile, output-affecting build
arguments, pruning implementation, image-cache implementation, and external image
digests determine identity. The Dockerfile frontend, `FROM` images, and external
`COPY --from` images are pinned in a generated Dockerfile used for both dependency
and final builds. Commit IDs and registry destinations do not determine identity.

`services.json` records OSS images and their build recipes. Turbo tasks are read
from each Dockerfile's prune command to keep fingerprinting and builds aligned.
Enterprise runs shared services with `workspace: ./oss`, giving exactly the same
inputs as OSS. Enterprise services use their own workspace and Dockerfiles; pass
all output-affecting build arguments through `build-arguments` as JSON. Credentials
for caching and Sentry upload are excluded. Unsupported dynamic external image
references or direct COPY inputs fail rather than silently produce unsafe keys.

On a hit, skip dependency-cache restoration, Warp Cache startup, and Docker setup.
Use `image-cache.ts copy SOURCE TARGETS` to copy by digest and verify destination
digests. It preserves the complete OCI image, including platform manifests. Builds
publish the fingerprint tag and existing aliases to GHCR. Trusted same-repository
PRs may publish to GHCR; fork PRs build without publishing or privileged cache access.
Enterprise non-PR deployment runs promote the GHCR image and aliases to ECR before
allowing deployment. Tests still run even when image builds are skipped.

Registry authorization errors are fatal. Missing manifests cause a build; transient
errors retry. Deleting a fingerprint image is safe and results in a cold build.
Mutable external base tags are resolved on every run, so base updates invalidate
reuse. Existing SHA tags without a fingerprint are not assumed safe to reuse.

Run `bun test src/tooling/docker-build/image-cache.test.ts` for fingerprint and
registry-failure regression coverage. For local registry experiments, install the
pinned regctl version from the action, configure the local registry's TLS setting,
and pass the same local repository as both destination and canonical arguments.
