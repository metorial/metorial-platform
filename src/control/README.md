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
target/release/control run test
target/release/control test:unit @lowerdeck/hash
target/release/control cleanup --dry-run
target/release/control docker stop
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

`control run [...ARGS]` can be used from a package directory or any of its
subdirectories. With arguments, it silently refreshes the development environment
in the same way as `control env`, then runs `bun run [...ARGS]` from the invoking
directory. With no arguments, it reads the nearest package.json directly and
prints the available scripts as `control run <script>` commands. The project root
(and the nested OSS root in an enterprise checkout) do not count as packages.

## Unit tests

```sh
control test:unit
control test:unit @lowerdeck/hash
control test:unit './oss/src/lowerdeck/**' '!@lowerdeck/redis'
control test:unit '@metorial/api...'
```

`control test:unit [FILTER...]` runs the workspace's `test` task directly on
the host with streaming output and a concurrency of one. Each argument is
forwarded unchanged as a native Turbo `--filter` expression. With no filters,
Turbo runs every workspace package that declares a `test` script, including
packages without a `control.toml`. The existing Turbo task graph still applies,
so dependency tests selected by `^test` also run.

The `test` package script is the unit-test contract and must not invoke E2E
tests. E2E suites belong in `test:e2e` and are not run by `control test:unit`.
This command does not refresh environments, install dependencies, generate
clients, build packages, start Docker, or prepare databases.

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
