# Metorial Control

`control` is a root-aware development orchestrator for standalone Metorial OSS
checkouts and enterprise checkouts containing an `oss/` worktree.

## Install

Install the lightweight launcher once:

```sh
npm install --global total-control
```

It registers `control` and can be called from any directory below an OSS or
enterprise checkout. The launcher walks upward to find the checkout and runs
that checkout's Control Rust CLI, so Cargo must be available:

```sh
cd src/metorial/services/core-api
control dev core-api
```

Use `npx total-control <command>` when you do not want a global install.

## Build and use

```sh
cargo build --release
target/release/control --help
target/release/control dev backend
target/release/control prepare --no-docker
target/release/control env
target/release/control cleanup --dry-run
target/release/control docker stop
target/release/control test e2e @metorial/shuttle
target/release/control workspace create feature/my-change --runtime=docker
target/release/control workspace list
target/release/control workspace remove feature/my-change
target/release/control workspace start
target/release/control workspace stop feature/my-change
```

Pass `--root PATH` to start project detection somewhere other than the current
directory.

## `control.toml`

Control recursively discovers manifests, excluding `.git`, `.control`,
`node_modules`, and `target`. Unknown fields, invalid environment names,
invalid database names, and missing local run dependencies are errors.
Discovery and preparation order is lexical and therefore deterministic.

```toml
name = "core-api"
group = "backend"
# Optional: "oss" or "enterprise"; omitted means both layouts.
mode = "both"
[endpoints.http]
port = 4310
env = [
  { key = "PORT", value = "{{PORT}}" },
  { key = "PUBLIC_URL", value = "http://{{HOSTNAME}}:{{PORT}}" },
]

[[dependencies]]
identifier = "api"
env = [
  { endpoint = "http", key = "API_URL", value = "http://{{HOSTNAME}}:{{PORT}}" },
]

[[resources]]
type = "redis"
env = [
  { key = "REDIS_URL", value = "redis://{{HOSTNAME}}:{{PORT}}/0" },
]

[test.e2e]
# Single-shot service commands; do not use watchers or process supervisors.
start = ["bun ./src/server.ts"]
# Additional npm workspace packages whose test:e2e scripts belong to this suite.
# These packages do not need control.toml manifests.
packages = ["integration-fixtures"]

# Strings are literals. `true` inherits the key from root env.json or the
# process environment when present.
[dev]
prepare = ["frontend:build"]
run = ["bun --watch ./src/server.ts"]

[dev.env]
LOG_LEVEL = "debug"
SECRET = true

[dev.db.main]
name = "metorial"
engine = "postgres"
env = "DATABASE_URL"

[docker]
compose = ["docker-compose.yml"]
services = ["redis"]
# Stop services on exit from `control dev`.
stop = true

[cleanup]
# Relative to this manifest and confined to the detected project root.
paths = ["dist", ".cache"]
```

Workspace-wide Prisma generation and schema push are always run by Control via
Turbo (`prisma:generate`, `prisma:push`) before package-local `prepare` scripts.
The root `build` script is then run (also Turbo, with enterprise/OSS filters).
Root `control.toml` files may still declare `mode` so they participate in
selection; they no longer need a `prepare = ["build"]` entry.

Package-local `prepare` entries are package.json script names (for example
`frontend:build` or `admin:build`). Control runs each as
`turbo run <script> --filter=<package>` so Turbo caching applies. Each prepare
script must also be declared under `tasks` in the root `turbo.json`. Do not put
Prisma or the global build in package-local prepare.

The repository's `name`/`group`/`dev` schema is preferred. An extended schema
is also accepted for external projects: `[package]`, `[env]`,
`[postgres.NAME]`, `[mongo.NAME]`, `[run.NAME]`, and `[groups]`. Detailed
environment values can use `{ from = "TOKEN", default = "" }`.

`run` and `cleanup` commands are intentionally shell strings. Control invokes
`/bin/sh -eu -c` on Unix and `cmd.exe /D /S /C` on Windows. Package-local
`prepare` entries are npm script names, not shell commands.

Literal, inherited, and default environment values support the strict
`{{HOSTNAME}}` template. It resolves from `METORIAL_HOSTNAME` and unknown or
unclosed templates are errors. Resource values can use
`{{CONTROL_PORT_POSTGRES}}`, `{{CONTROL_PORT_MONGO}}`,
`{{CONTROL_PORT_REDIS}}`, `{{CONTROL_PORT_NATS}}`,
`{{CONTROL_PORT_ETCD_CLIENT}}`, and `{{CONTROL_PORT_ETCD_PEER}}`. Source
checkouts receive the standard development ports; host workspaces receive their
persisted allocation. Native development defaults the hostname to `localhost`;
host workspaces always use `localhost`, while Docker workspaces use their
branch-derived `<branch>.localhost` hostname.

Package and group arguments select manifests. With no selectors all manifests
are used. Each generated Turbo mirror receives its manifest's isolated
environment.

Each `[[dependencies]]` entry names a Control package with `identifier`. Its
`env` entries select one of that package's `[endpoints.NAME]` declarations and
resolve `{{HOSTNAME}}` and `{{PORT}}`. Endpoint `env` entries tell the owning
service its actual hostname/port. Source checkouts and Docker workspace
internals use endpoint defaults; host workspaces persist conflict-free actual
ports; E2E allocates conflict-free ports per run.

Dependencies default to `start = true`, which includes the target in dependency
closure, cycle detection, and dependency-first startup. Set `start = false` for
an endpoint-only reference such as a reverse callback URL:

```toml
[[dependencies]]
identifier = "public-api"
start = false
env = [
  { endpoint = "http", key = "CALLBACK_URL", value = "http://{{HOSTNAME}}:{{PORT}}" },
]
```

The target is still validated and its endpoint environment is resolved, but the
edge does not pull or start it. E2E starts that target only when another
`start = true` edge or direct selection includes it.

`[[resources]]` declares one Redis, NATS, or etcd requirement per type. Resource
environment uses the runtime-selected host/port and may use the corresponding
`CONTROL_PORT_*` templates. Postgres and MongoDB retain their existing model.
Discovery rejects unknown/self/cyclic/mode-incompatible dependencies, unknown
endpoints, malformed names or ports, duplicate resources/environment keys, and
invalid templates. Environment keys must be unique across package environment,
endpoint, dependency, resource, and database bindings. A run environment also
cannot override one of those shared keys; separate runs may reuse keys because
their environments are isolated.

Development optionally reads a root `control-external.toml`:

```toml
[[external]]
identifier = "api"
hostname = "api.dev.example.com"

[external.mapping]
http = 443
```

External identifiers and mapping endpoints must exist, and every endpoint used
by dependency environment wiring must be mapped. Development omits external
packages from local startup and injects the configured host/ports. E2E ignores
externals and starts dependencies locally. Docker workspaces resolve every
configured external hostname on the host and add it to the workspace
container's hosts configuration. Changing that resolved configuration recreates
the container while retaining workspace volumes. `CONTROL_SERVICES_HOST`
remains an optional address override for the hostname `services`.

`[test.e2e]` is an explicit opt-in. Its `start` array defines single-shot
service commands used instead of `[dev].run`; these commands must not launch
watchers or process supervisors. Its `packages` array contains arbitrary npm
workspace package names, including packages without a `control.toml`. Control
discovers package.json files recursively while excluding `.git`, `.control`,
`node_modules`, and `target`, and validates these names when building an E2E
plan.

`control dev` starts Compose projects, waits for declared databases, creates
databases idempotently, writes package-local `.env` files, then prepares the
workspace in this order:

1. `turbo run prisma:generate` (all packages)
2. `turbo run prisma:push` (all packages)
3. `bun run build` (Turbo via the root build script, with workspace filters)
4. package-local `control.toml` prepare scripts via `turbo run <script> --filter=<package>`

It then generates an isolated `.control/dev` Turbo workspace with one mirror
package per run command and invokes Turbo directly with explicit filters.
Ctrl-C terminates Turbo and performs configured Docker cleanup. Because prepare
pushes every Prisma schema, dependency services cover the full workspace even
when only a subset of applications are started.

For Postgres, database creation uses `docker compose exec` when `compose` and
`service` are supplied, otherwise the local `pg_isready` and `psql` clients.
MongoDB follows the same rule using `mongosh`; an empty database receives a
`__control` collection so that it persists.

`control prepare` writes environment files and runs the same preparation
sequence without starting Turbo or any application processes. It starts
declared dependencies unless `--no-docker` is passed.

## Docker E2E tests

```sh
control test e2e @metorial/shuttle
control test e2e @metorial/mte-core-api @metorial/mte-global-router
control test e2e --all
```

Each selector must resolve to one named Control package. Multiple selections
run sequentially in independent environments; `--all` selects every manifest
that declares `[test.e2e]`. In enterprise checkouts, Control infers OSS mode
when a selected manifest lives under `oss/`, so no mode flag is required. The
command requires a Docker host and intentionally does not run inside a Control
workspace container. Control generates a self-contained
`.control/test/docker-compose.yml` and runner assets.
The Compose project gets fresh Postgres 17, MongoDB 8, Redis 7.4, NATS 2.11,
and etcd data volumes on every invocation. Checkout-derived external volumes
persist `node_modules`, Bun, Cargo target/registry, and Go build/module caches
across E2E runs; normal E2E cleanup never removes those caches, so the next
`bun install` reuses the checkout's existing Linux `node_modules` volume.

One shared test container uses the same content-hashed development image as
Docker workspaces. Each invocation has a unique generated directory and Compose
project. Control generates read-only `.env` overlays for every discovered
Control manifest with environment or database values, including manifests
outside the selected source graph and mode-inactive packages that workspace-wide
Turbo tasks can still visit. These overlays mask checkout and host-workspace
`.env` files without modifying them. The selected package receives its test
environment at both `.env` and `.env.test`; startup dependencies and unrelated
workspace packages receive unsuffixed isolated E2E environments.

The runner creates every Postgres database required by workspace-wide schema
tasks plus selected test database variants. MongoDB retains lazy database
creation; readiness is provided by the Mongo container health check and
forwarded TCP port, so the shared runner does not require `mongosh`.
Workspace-wide Prisma tasks receive non-generic database variables (for example
`CARGO_DATABASE_URL` and federation URLs) only from the active source graph.
Variables declared only by non-source or mode-inactive packages, plus generic
`DATABASE_URL`, remain package-local under mounted overlays. This prevents
mutually exclusive OSS and enterprise declarations from colliding in the root
process environment. Control then runs `bun install`, workspace Prisma
generate/push tasks, and only the selected source manifests' declared prepare
scripts. It intentionally skips the production root build.

The runner starts development commands dependency-first, one Control manifest
at a time. Before starting the next manifest it waits for the current
manifest's allocated named endpoint ports while checking every development
process for early exit. Workers without endpoints must survive a deterministic
two-second startup grace. Resource URLs are generated from structured resource
declarations; arbitrary `services` URLs are not rewritten. Included npm
packages are test targets only and are not started as services. Compose attaches output only from
`control-e2e`, keeping dependency health logs out of normal output. Tests run
sequentially in this order:

1. the selected package
2. packages listed by `[test.e2e].packages`

The selected package's and each explicitly included npm package's `test:e2e`
script is run when present. Control dependencies are source services only; to
run a dependency's tests, select it in a separate command, which gives it a
fresh Compose project and volumes. Included npm packages receive the selected
Control package's test environment. Declared database URLs are rewritten to
deterministic test databases (`<declared-name>-test`, without double suffixing
an existing `-test` name), `NODE_ENV` is set to `test`, and those Postgres test
databases are provisioned alongside dependency source databases. Control runs
`db:push:test` when declared. Packages without that script fall back to
`prisma:push` under the mounted test environment; packages without either
schema script continue without schema preparation.

Dependency development processes use unsuffixed fresh databases. Mongo test
URLs use the same suffix and retain Mongo's lazy creation behavior. A missing
test script emits a warning and does not fail the suite. Development
processes, containers, networks, and volumes are cleaned up after success,
failure, or interrupt. A hard host or Docker daemon crash can leave the
deterministic Compose project behind; the next invocation removes it before
starting.

`control workspace create BRANCH --runtime=host|docker` creates a sibling
worktree. The runtime flag is required and is stored in
`.control/workspace.json`. Enterprise mode creates the enterprise worktree and
a paired OSS worktree at its `oss/` path. Both runtimes run `bun install`, build
Control, and run the normal preparation sequence during first initialization.
Application services are not started.

Docker workspaces perform setup inside a persistent Ubuntu development
container. Host workspaces perform setup directly on the host and generate an
isolated dependency stack at `.control/services.docker-compose.yml`. Its
Postgres, MongoDB, Redis, NATS, and etcd host ports are allocated once and
persisted in workspace metadata. Containers, networks, volumes, and ports are
therefore independent between host workspaces. Named application endpoint ports
are also allocated once and persisted, so host workspaces can run concurrently.

`control workspace list` prints linked worktrees for the repository (branch,
path, and workspace identity when metadata is present).
`control workspace remove BRANCH` removes the matching worktree, including the
paired OSS worktree in enterprise mode.

## Workspace runtimes

Create a workspace by choosing its execution runtime:

```sh
control workspace create feature/docker-change --runtime=docker
control workspace create feature/host-change --runtime=host
```

Existing workspace metadata without a runtime is treated as `docker`.

For a host workspace, `workspace start` starts its generated dependency stack,
ensures host setup is current, and opens the local worktree in VS Code.
`workspace dev` and `workspace shell` execute from the worktree on the host.
`workspace stop` retains dependency data, while `workspace stop --volumes`
removes it. `--rebuild` is Docker-only. Host mode requires Bun, Cargo, Docker,
and the `code` shell command to be installed locally.

When a new host workspace is created, Control starts the source checkout's
`dev_services` Postgres service and clones every non-template user database into
the workspace's isolated Postgres volume. The snapshot is installed once,
before Prisma and package preparation; subsequent starts preserve
workspace-local database changes. A dump or restore failure aborts workspace
creation and removes the incomplete workspace. Docker workspaces do not clone
the source databases.

### Docker workspaces

Prerequisites are Docker, VS Code's `code` shell command, and the
`ms-vscode-remote.remote-containers` Dev Containers extension.

```sh
control workspace start
control workspace connect
control workspace start feature/my-change
control workspace start --rebuild
control workspace start --no-open
control workspace connect feature/my-change
control workspace dev
control workspace dev feature/my-change
control workspace shell
control workspace shell feature/my-change
control workspace stop
control workspace stop feature/my-change
control workspace stop --volumes
control workspace status
control workspace status feature/my-change
```

Pass a branch name to `start`/`connect`, `dev`, `shell`, `stop`, or `status` to
target that workspace from the source checkout (or any other worktree). Omit it
to operate on the current checkout.

The command builds an Ubuntu 24.04 image containing zsh, Bun 1.2.15, Node.js
22/npm, the globally installed `total-control` launcher, Go 1.25, Rust 1.91.1,
Air, and native build tools. It bind mounts the worktree at `/workspace`.
`workspace start` and its `workspace connect` alias start the dependency stack
and idle container, open a VS Code window attached to the named container, and
return. `workspace dev` ensures the container is running and then executes
`bun control` inside it (so you can start application services with the Control
CLI from the host). Control detects the workspace container and reuses its
managed dependencies instead of trying to launch Docker there.

VS Code installs the server version matching the host editor on first attach.
The server directory is a workspace-scoped persistent volume, so normal
container replacement does not require another download.

Dependency and compiler caches, setup state, and the VS Code server are
persistent, workspace-scoped Docker volumes. A private `node_modules` volume
keeps Linux dependencies separate from the host's Darwin install. Generated
`.env`, `.control`, Prisma, and frontend files remain in the worktree so the
editor and container see the same output. The source checkout's `env.json` is
mounted read-only when a worktree does not provide its own override.

A single global Traefik container owns the declared HTTP ports and routes each
request by host header. A workspace for branch `feature/auth` therefore uses
URLs such as:

```text
http://feature-auth.localhost:4310
http://feature-auth.localhost:4300
```

Port 80 on the workspace hostname redirects to the same host on port 4300, so
`http://feature-auth.localhost/` is equivalent to
`http://feature-auth.localhost:4300/`.

On start, Control writes `HOST.md` at the workspace root (visible inside the
container as `/workspace/HOST.md`) listing every exposed HTTP endpoint for that
hostname, grouped by package.

`.localhost` resolves without host-file changes on supported systems. Every
HTTP listener that should be reachable from the host must have a named endpoint
declaration and bind to `0.0.0.0`. Non-HTTP ports remain
internal to the all-in-one container.

Every workspace owns persistent Postgres, MongoDB, Redis, NATS, and etcd
services. `workspace stop` stops both the workspace container and dependencies
without removing containers or volumes. `workspace start` or `workspace connect`
resumes them. `workspace stop --volumes` explicitly removes the container,
compiler/dependency/VS Code volumes, and dependency data.
