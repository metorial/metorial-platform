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
target/release/control env
target/release/control cleanup --dry-run
target/release/control docker stop
target/release/control workspace create feature/my-change
target/release/control workspace list
target/release/control workspace remove feature/my-change
target/release/control workspace dev
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
prepare = ["bun run prisma:generate"]
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

The repository's `name`/`group`/`dev` schema is preferred. An extended schema
is also accepted for external projects: `[package]`, `[env]`,
`[postgres.NAME]`, `[mongo.NAME]`, `[run.NAME]`, and `[groups]`. Detailed
environment values can use `{ from = "TOKEN", default = "" }`.

Commands are intentionally shell strings. Control invokes `/bin/sh -eu -c` on
Unix and `cmd.exe /D /S /C` on Windows.

Literal, inherited, and default environment values support the strict
`{{HOSTNAME}}` template. It resolves from `METORIAL_HOSTNAME` and unknown or
unclosed templates are errors. Native development defaults it to `localhost`;
Docker workspaces use their stable `<workspace>.localhost` hostname.

Package and group arguments select manifests. With no selectors all manifests
are used. Each generated Turbo mirror receives its manifest's isolated
environment.

`control dev` starts Compose projects, waits for declared databases, creates
databases idempotently, writes package-local `.env` files, performs preparation
in manifest order, and generates
an isolated `.control/dev` Turbo workspace with one mirror package per run
command. It then invokes Turbo directly with explicit filters. Ctrl-C
terminates Turbo and performs configured Docker cleanup.

For Postgres, database creation uses `docker compose exec` when `compose` and
`service` are supplied, otherwise the local `pg_isready` and `psql` clients.
MongoDB follows the same rule using `mongosh`; an empty database receives a
`__control` collection so that it persists.

`control workspace create BRANCH` creates a sibling worktree. Enterprise mode
creates the enterprise worktree and a paired OSS worktree at its `oss/` path.
Failures are rolled back best-effort. After creation it runs `bun install` and
builds the workspace's Control binary, then attempts to open the path using
`code`, unless `--no-open` is passed. The original `control workspace BRANCH`
syntax remains supported.

`control workspace list` prints linked worktrees for the repository (branch,
path, and workspace identity when metadata is present).
`control workspace remove BRANCH` removes the matching worktree, including the
paired OSS worktree in enterprise mode.

## Docker workspaces

Run a complete worktree in one development container:

```sh
control workspace dev
control workspace dev backend
control workspace dev --isolated-services
control workspace dev --rebuild
control workspace stop
control workspace stop --services
control workspace stop --volumes
control workspace status
```

The command builds a pinned Debian toolchain image containing Bun 1.2.15,
Node.js 22/npm, Go 1.25, Rust 1.91.1, Air, and native build tools. It bind
mounts the worktree at `/workspace`, runs `bun install`, and then runs the
normal manifest/Turbo pipeline with Docker provisioning disabled inside the
container. Turbo, Prisma, Vite, and TypeScript come from the repository
lockfile rather than global installations.

Dependency and compiler caches are persistent, workspace-scoped Docker
volumes. Generated `.env`, `.control`, Prisma, and frontend files remain in the
worktree so the editor and container see the same output. The source
checkout's `env.json` is mounted read-only when a worktree does not provide its
own override.

A single global Traefik container owns the declared HTTP ports and routes each
request by host header. A workspace named `feature-auth-1234abcd` therefore
uses URLs such as:

```text
http://feature-auth-1234abcd.localhost:4310
http://feature-auth-1234abcd.localhost:4300
```

`.localhost` resolves without host-file changes on supported systems. Every
HTTP listener that should be reachable from the host must have a
`[[dev.expose]]` declaration and bind to `0.0.0.0`. Non-HTTP ports remain
internal to the all-in-one container.

By default, Docker workspaces share the normal global Postgres, MongoDB,
Redis, NATS, and etcd services. `--isolated-services` creates a private
Compose project and persistent volumes for all five. Stopping development
removes only the application container; `workspace stop --services` stops the
private services, and `workspace stop --volumes` explicitly deletes their
data.
