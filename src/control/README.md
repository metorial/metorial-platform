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
target/release/control workspace create feature/my-change
target/release/control workspace list
target/release/control workspace remove feature/my-change
target/release/control workspace dev
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
prepare = ["bun run frontend:build"]
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

Workspace-wide Prisma generation, schema push, and `bun run build` are always
run by Control before package-local `prepare` commands (via the root
`prisma:generate`, `prisma:push`, and `build` scripts, which use Turbo for
caching). Root `control.toml` files may still declare `mode` so they participate
in selection; they no longer need a `prepare = ["bun run build"]` entry.

Package-local `prepare` should only contain package-specific steps (for example
`frontend:build` or `admin:build`), not Prisma or the global build.

The repository's `name`/`group`/`dev` schema is preferred. An extended schema
is also accepted for external projects: `[package]`, `[env]`,
`[postgres.NAME]`, `[mongo.NAME]`, `[run.NAME]`, and `[groups]`. Detailed
environment values can use `{ from = "TOKEN", default = "" }`.

Commands are intentionally shell strings. Control invokes `/bin/sh -eu -c` on
Unix and `cmd.exe /D /S /C` on Windows.

Literal, inherited, and default environment values support the strict
`{{HOSTNAME}}` template. It resolves from `METORIAL_HOSTNAME` and unknown or
unclosed templates are errors. Native development defaults it to `localhost`;
Docker workspaces use their branch-derived `<branch>.localhost` hostname.

Package and group arguments select manifests. With no selectors all manifests
are used. Each generated Turbo mirror receives its manifest's isolated
environment.

`control dev` starts Compose projects, waits for declared databases, creates
databases idempotently, writes package-local `.env` files, then prepares the
workspace in this order:

1. `bun run prisma:generate` (Turbo, all packages)
2. `bun run prisma:push` (Turbo, all packages)
3. `bun run build` (Turbo via the root build script)
4. package-local `control.toml` prepare commands

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

`control workspace create BRANCH` creates a sibling worktree. Enterprise mode
creates the enterprise worktree and a paired OSS worktree at its `oss/` path.
It then starts a persistent Ubuntu development container and a private
dependency stack. The first initialization runs `bun install`, builds Control,
and runs `control prepare --no-docker` inside the container (prisma generate,
prisma push, build, and package prepare). After setup it opens `/workspace`
through VS Code's Dev Containers extension unless `--no-open` is passed.
Application services are not started.

`control workspace list` prints linked worktrees for the repository (branch,
path, and workspace identity when metadata is present).
`control workspace remove BRANCH` removes the matching worktree, including the
paired OSS worktree in enterprise mode.

## Docker workspaces

Prerequisites are Docker, VS Code's `code` shell command, and the
`ms-vscode-remote.remote-containers` Dev Containers extension.

```sh
control workspace dev
control workspace start
control workspace dev feature/my-change
control workspace dev --rebuild
control workspace dev --no-open
control workspace shell
control workspace shell feature/my-change
control workspace stop
control workspace stop feature/my-change
control workspace stop --volumes
control workspace status
control workspace status feature/my-change
```

Pass a branch name to `dev`/`start`, `shell`, `stop`, or `status` to target that
workspace from the source checkout (or any other worktree). Omit it to operate
on the current checkout.

The command builds an Ubuntu 24.04 image containing zsh, Bun 1.2.15, Node.js
22/npm, the globally installed `total-control` launcher, Go 1.25, Rust 1.91.1,
Air, and native build tools. It bind mounts the worktree at `/workspace`.
`workspace dev` and its `workspace start` alias start the dependency stack and
idle container, open a VS Code window attached to the named container, and
return. Start the desired application services manually from VS Code's zsh
terminal with `control dev`. Control detects the workspace container and reuses
its managed dependencies instead of trying to launch Docker there.

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
without removing containers or volumes. `workspace dev` or `workspace start`
resumes them. `workspace stop --volumes` explicitly removes the container,
compiler/dependency/VS Code volumes, and dependency data.
