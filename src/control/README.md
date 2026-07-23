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
# Control package names required when this package is developed or tested.
dependencies = ["database", "api"]

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

[[dev.expose]]
# HTTP/WebSocket listener exposed through the workspace hostname proxy.
port = 4310

[dev.env]
LOG_LEVEL = "debug"
PUBLIC_URL = "http://{{HOSTNAME}}:4310"
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
unclosed templates are errors. Dependency URLs can use
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

`dependencies` contains Control package names. Discovery rejects unknown
packages, self references, dependency cycles, and references unavailable in any
mode where the referring package is active. Dependency closure is transitive,
deterministic, and is applied by normal dev, prepare, env, cleanup, and Docker
selection.

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
project. Control generates read-only environment overlays for the selected
package and its dependency sources, then mounts those overlays over the
container's package-local `.env`/`.env.test` paths without modifying checkout
files. The selected source and its tests use suffixed test databases;
dependency sources use unsuffixed development databases. The runner creates
every required Postgres database idempotently. MongoDB databases are left to
Mongo's normal lazy creation behavior; readiness is provided by the Mongo
container health check and forwarded TCP port, so the shared runner does not
require `mongosh`.
Workspace-wide Prisma tasks receive all distinct database variables (for
example `CARGO_DATABASE_URL` and federation URLs), while generic
`DATABASE_URL` remains package-local. Control then runs `bun install`, workspace
Prisma generate/push tasks, and the selected Control manifests' declared
prepare scripts. It intentionally skips the production root build.

The runner starts development commands dependency-first, one Control manifest
at a time. Before starting the next manifest it waits for the current
manifest's declared `[[dev.expose]]` TCP ports while checking every development
process for early exit. Workers without exposures must survive a deterministic
two-second startup grace. If a later manifest repeats an already-ready port,
Control uses the same survival check instead of accepting the earlier
listener as proof that the later source is ready. Service URLs using the normal
`services` host are localized to `localhost` in generated E2E environments, so
the selected test uses the object-storage, relay, and other dev processes
running in the shared container. Included npm packages are test targets only
and are not started as services. Compose attaches output only from
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
therefore independent between host workspaces. Application ports declared by
`[[dev.expose]]` remain fixed, so multiple host workspaces cannot run the same
application service concurrently.

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
HTTP listener that should be reachable from the host must have a
`[[dev.expose]]` declaration and bind to `0.0.0.0`. Non-HTTP ports remain
internal to the all-in-one container.

The hostname `services` (object storage, relay, and similar) is resolved on the
host — including Tailscale MagicDNS — and injected into the container with
`--add-host`. Override with `CONTROL_SERVICES_HOST` when needed.

Every workspace owns persistent Postgres, MongoDB, Redis, NATS, and etcd
services. `workspace stop` stops both the workspace container and dependencies
without removing containers or volumes. `workspace start` or `workspace connect`
resumes them. `workspace stop --volumes` explicitly removes the container,
compiler/dependency/VS Code volumes, and dependency data.
