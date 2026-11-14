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
that checkout's TypeScript Control CLI with Bun, so Bun must be available:

```sh
cd src/metorial/services/core-api
control dev core-api
```

Use `npx total-control <command>` when you do not want a global install.

## Use

From the checkout root:

```sh
bun run control --help
bun run control dev backend
bun run control prepare --no-docker
bun run control env
bun run control run test
bun run control test:unit @lowerdeck/hash
bun run control test:e2e @metorial/module-user
bun run control cleanup --dry-run
bun run control docker stop
bun run control docker reset --yes
bun run control workspace create feature/my-change
bun run control workspace list
bun run control workspace remove feature/my-change
bun run control workspace start
bun run control workspace stop feature/my-change
```

`docker stop` keeps data; `docker reset` removes the declared Compose services together
with their volumes, so every database and the object store start empty on the next
`control dev`. It refuses to run without `--yes`; `--dry-run` prints the Compose
commands instead.

### Daemon, TUI and web UI

`control dev` no longer needs one terminal per workspace. Workspaces run inside one shared
background daemon that is started on demand; the CLI is a thin client and `control dev`
attaches the log TUI. Pass `--foreground` for the previous behavior (Turbo TUI in the
current terminal).

Before starting or restarting a service, control checks its local bind ports for TCP
listeners using `lsof` (required on the host). It logs each conflicting process's name,
PID and port, sends `SIGTERM`, then uses `SIGKILL` if the port remains occupied after
three seconds. Startup waits for the ports to be released and fails if cleanup cannot
complete. Other active commands managed by the workspace are preserved. Foreground
mode performs the same cleanup before launching its services.

```sh
bun run control up              # start the workspace in the daemon and return
bun run control ls              # all workspaces known to the daemon
bun run control status          # units of this workspace
bun run control logs -f api     # plain log list; a TUI on a terminal unless piped
bun run control tui             # log TUI
bun run control restart api     # one unit (infra included); no argument restarts the workspace
bun run control job db:push     # db:generate | db:push | db:migrate | prepare
bun run control open mail       # dashboard, mail, any declared link, or the web UI
bun run control sh api          # shell with the environment of a unit
bun run control down            # stop the workspace and its infrastructure (--keep-infra to leave it running)
bun run control daemon status   # start | stop | restart | status | logs
```

The web UI listens on `http://localhost:1000` (`CONTROL_UI_PORT` to change it). It lists the
workspaces, links to the dashboard, mail and admin panels, restarts units or whole
workspaces, runs database jobs and offers a terminal in the workspace environment.
Manifests declare their links with `link = { label = "...", group = "app" | "admin" | "tool" }`
on an endpoint. Daemon state lives in `~/.metorial-control-dev-service` (`CONTROL_HOME`);
stopping the daemon stops the workspaces it runs. See `docs/daemon-plan.md`.

Pass `--root PATH` to start project detection somewhere other than the current
directory.

## Implementation and verification

The CLI is implemented in `src/*.ts` and runs directly with Bun, including in CI.
Actions invoke `bun <control-directory>/src/main.ts`; no build or binary artifact
is needed. The in-repository `@lowerdeck/validation` package resolves through
`tsconfig.json`, so planning commands can run without a monorepo install.
The npm package remains a lightweight Node launcher that finds the checkout and
invokes its TypeScript entrypoint with Bun.

From this directory:

```sh
bun run typecheck
bun run test
bun run lint
CONTROL_DOCKER_TESTS=1 bun test test/docker.integration.test.ts
```

The original Rust implementation has been removed. Compatibility tests compare
commands against captured outputs from that implementation, including generated
environment files. Commands, tests, CI and workspace setup require no Rust
compiler for Control.

The tests cover strict manifest validation, selection and dependency ordering,
environments, metadata upgrades, process cancellation and binary pipelines,
locks, Turbo generation, CI and E2E plans, proxy sessions, command execution,
worktree creation/removal and rollback. The opt-in Docker test provisions all five
infrastructure services, creates Postgres and MongoDB databases, verifies repeat
provisioning, and removes its isolated containers and volumes.

## `control/index.ts`

Every package that Control manages has a `control/index.ts` next to its
`package.json`. The file default-exports a project built with the
`@metorial/control` DSL (`oss/src/platform/packages/control`). Control discovers
these files recursively, excluding `.git`, `.control`, `node_modules`, `target`
and `out`, evaluates them in a subprocess, and validates the result strictly.
Unknown fields, invalid environment names, invalid database names, and missing
local run dependencies are errors. Discovery and preparation order is lexical and
therefore deterministic.

```ts
import { dev, endpoint, fromEnv, inherit, postgres, project } from '@metorial/control';

export default project({
  name: 'core-api',
  group: 'backend',
  mode: 'both',
  endpoints: {
    api: endpoint(4310).health('/ping').listenEnv('API_PORT')
  },
  dev: dev({
    prepare: ['frontend:build'],
    run: ['bun --watch ./src/server.ts'],
    env: {
      LOG_LEVEL: 'debug',
      PUBLIC_URL: 'http://{{HOSTNAME}}:4310',
      SECRET: inherit()
    },
    databases: {
      main: postgres({ package: 'core-api', name: 'metorial', env: 'DATABASE_URL' })
    }
  })
});
```

Shared env blocks, service ports and databases live in `@metorial/control/presets`.
Inspect the compiled result with the manifest typecheck (`bun run typecheck` in
`oss/src/tooling/control`), which type checks every `control/index.ts` in the repo.
`control-external.toml` is still TOML.

Workspace-wide Prisma generation and schema push are always run by Control via
Turbo (`prisma:generate`, `prisma:push`) before package-local `prepare` scripts.
The root `build` script is then run (also Turbo, with enterprise/OSS filters).
Root `control/index.ts` files may still declare `mode` so they participate in
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
`{{CONTROL_PORT_ETCD_CLIENT}}`, `{{CONTROL_PORT_ETCD_PEER}}`,
`{{CONTROL_PORT_MAIL}}` (SMTP), and `{{CONTROL_PORT_MAIL_UI}}`. A `mail`
resource starts Mailpit, which catches all outgoing email; its inbox is at
`http://localhost:<CONTROL_PORT_MAIL_UI>` and, through the shared proxy, at
`http://<workspace hostname>:8025` for every workspace. Source
checkouts receive the standard development ports; host workspaces receive their
persisted allocation. Native development defaults the hostname to `localhost`;
source checkouts use `metorial-root.localhost`; branch workspaces use their
branch-derived `metorial-<branch>.localhost` hostname. Host listeners use persisted
private bind ports behind the shared hostname proxy.

With the workspace running and its Mailpit link reachable, use
`control email list` to find message IDs and `control email open <id>` to read a
message in the terminal. HTML bodies are converted to Markdown with Turndown.
Plain-text messages display their text body. Pass `--html` to print only the
original HTML body. Both commands support `--ws <id>`. The list defaults to the
latest 50 messages and accepts `--start <offset>` and `--limit <count>`.

Package and group arguments select manifests. With no selectors all manifests
are used. Each generated Turbo mirror receives its manifest's isolated
environment.

`control dev` starts Compose projects, waits for declared databases, creates
databases idempotently, then prepares the workspace in this order:

1. `turbo run prisma:generate` (all packages)
2. `turbo run prisma:push` (all packages)
3. `bun run build` (Turbo via the root build script, with workspace filters)
4. package-local `control/index.ts` prepare scripts via `turbo run <script> --filter=<package>`

Environment variables are passed to every process directly (Turbo runs with
`--env-mode=loose`, and `dev` and `control:db:*` have `passThroughEnv` in
`turbo.json`); no `.env` files are written. `control env` still writes them on
request.

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
control test:unit './oss/src/lib/**' '!@lowerdeck/redis'
control test:unit '@metorial/api...'
```

`control test:unit [FILTER...]` runs the workspace's `test` task directly on
the host with streaming output and a concurrency of one. Each argument is
forwarded unchanged as a native Turbo `--filter` expression. With no filters,
Turbo runs every workspace package that declares a `test` script, including
packages without a `control/index.ts`. The existing Turbo task graph still applies,
so dependency tests selected by `^test` also run.

The `test` package script is the unit-test contract and must not invoke E2E
tests. E2E suites belong in `test:e2e` and are not run by `control test:unit`.
This command does not refresh environments, install dependencies, generate
clients, build packages, start Docker, or prepare databases.

## E2E tests

```sh
control test:e2e                                   # every stack and test package
control test:e2e @metorial/module-user '@metorial/api-*'
control test:e2e @metorial/app-api --keep          # one stack, leave containers up
control test:e2e @metorial/api-core -- e2e/management -t creates   # Vitest args per suite
control test:e2e --plan                            # print the resolved plan as JSON
control test:e2e --images DIR --workspace PATH     # CI: run tested images
```

A package that declares `[e2e] tests` is a **stack** (system under test, SUT).
Its test packages are the workspace packages matched by `tests` (relative to
the manifest) that declare a `test:e2e` script. Packages without that script
are skipped. Filters match stack or
test package names (`*` wildcards); selecting a stack selects all its tests.

```toml
[endpoints.api]
port = 4310
health = "/ping"            # or { path = "/ping", status = 200 }
protocol = "h2c"             # optional: the proxy talks cleartext HTTP/2 (gRPC) to this endpoint
env = [{ key = "API_PORT", value = "{{BIND_PORT}}" }]

# For processes without a named HTTP endpoint.
[[health]]
port = 12131
path = "/"

[e2e]
# Every service that e2e can start (SUT or dependency):
start = ["e2e:start"]       # package.json scripts started from source (no watch)
image = "app-api"           # tested image artifact name for --images

# Stack-only keys:
tests = ["../../../../metorial/products/*/modules/*", "../../../*/modules/*", "../../../*/apis/*", "../../../../metorial/apis/*"]
services = ["@mtsrc/mcp-runtime-service"]   # started in addition to [[dependencies]]
health_timeout = 300

[[e2e.resources]]
type = "object-storage"     # reachable as http://services:52010

[e2e.env]                   # e2e-only overrides, e.g. dummies for `true` secrets
AWS_ACCESS_KEY_ID = "e2e"
```

Every dependency and SUT must declare at least one health check and, depending
on the mode, `e2e.start` or `e2e.image`; the plan fails otherwise. All services
share one network namespace with a gateway that forwards the standard
`localhost` infrastructure ports, so `control/index.ts` URLs work unchanged and
endpoint ports must be unique across a run.

Arguments after `--` reach every selected suite's Vitest run (file filters,
`-t <name>`), so they're mostly useful together with a single test package.
Only one e2e run executes per machine at a time: runs take an exclusive lock
(`metorial-control-e2e.lock` in the temp directory) and wait for the holder to
finish.

A run creates a Compose project under `.control/e2e/<run>/` with tmpfs
Postgres, MongoDB, Redis, NATS (and object storage when requested), then:

1. creates every declared database;
2. starts all dependencies at once and waits until every health check passes;
3. starts all SUTs and waits for their health checks;
4. runs `turbo run test:e2e` for each stack's selected test packages with the
   stack's environment plus `CONTROL_E2E=1` and `CONTROL_E2E_ENDPOINTS`
   (package → endpoint name → URL).

`test:e2e` results are cached per test package. Besides the package's own
inputs and dependencies, the Turbo hash includes `CONTROL_E2E_STACK_KEY`: a
digest of the stack's environment and of every service it runs against, each
fingerprinted by the `e2e:fingerprint` Turbo task (the service package and its
dependency closure, excluding `e2e/` folders and unit tests). Editing one
module's e2e suite therefore reruns only that suite, while any change to code
the services run reruns the whole stack. Failed suites are never cached. A
package that defines `test:e2e` outside a control stack opts out with a
package `turbo.json` setting `"cache": false`. When `TURBO_API` points at a
local remote-cache proxy, the runner reaches it through `host.docker.internal`
and receives `TURBO_TEAM`, `TURBO_TOKEN` and
`TURBO_REMOTE_CACHE_SIGNATURE_KEY` from the calling environment.

Locally, the runner container syncs the checkout into a persistent
`control-e2e-<hash>` volume (excluding `node_modules`, `.env*`, build output),
installs dependencies when the lockfile changed, generates clients, pushes
schemas, builds, and starts services from source. With `--images`, services run
from the digest-pinned images in `DIR/<image>.json` and the runner uses the
prepared `--workspace` as is. Logs are written to `.control/e2e/<run>/logs`;
containers and volumes are removed unless `--keep` is passed.

`control workspace create BRANCH` creates a sibling host-runtime worktree and
stores that runtime in `.control/workspace.json`. Enterprise mode creates the
enterprise worktree and a paired OSS worktree at its `oss/` path. It runs
`bun install` and the normal preparation sequence during
first initialization. Application services are not started.

Docker workspaces perform setup inside a persistent Ubuntu development
container. Host workspaces perform setup directly on the host and generate an
isolated dependency stack at `.control/services.docker-compose.yml`. Its
Postgres, MongoDB, Redis, NATS, and etcd host ports are allocated once and
persisted in workspace metadata. Containers, networks, volumes, and ports are
therefore independent between host workspaces. Public application ports declared by
`[[dev.expose]]` remain fixed. Each host workspace receives private bind ports
and routes through the shared hostname proxy, allowing concurrent workspaces.

`control workspace list` prints linked worktrees for the repository (branch,
path, and workspace identity when metadata is present).
`control workspace remove BRANCH` removes the matching worktree, including the
paired OSS worktree in enterprise mode.

## Stacks

A stack is a named set of services that runs together in Docker Compose. Stacks are not
hard coded: the root `control/index.ts` declares them with `stack()` and every service
opts in with `stackMember()`, so a service can join several stacks.

```ts
// control/index.ts
rootProject({ mode: 'enterprise', stacks: [stack({ id: 'cloud', label: 'Metorial Cloud' })] });

// a service's control/index.ts
project({
  name: '@mtsrc/auth-core-service',
  stacks: {
    cloud: stackMember(),
    'on-prem': stackMember({ production: { image: 'ghcr.io/metorial/auth-core' } })
  }
});
```

`stackMember()` accepts `env` for both environments, `development: { run, env }` to override
the commands run in dev (or `false` to leave the service out of the dev stack), and
`production: { image, dockerfile, workspace, args, command, env }` (or `false`) to choose
the container. Without overrides the production container is built from the package's
`ci.images` or `ci.dockerfiles` entry. Stack declarations in a checkout that does not
define the stack are ignored, so the OSS submodule still works on its own.

```bash
control stack ls                               # stacks defined in this checkout
control stack plan cloud --env prod            # units a run would start
control stack images on-prem                   # images the production stack builds (--json)
control stack start cloud --env dev            # all members in one container, run by bun
control stack start cloud --env prod --name qa # one production container per member
control stack restart cloud
control stack stop cloud [--volumes]
control stack clean cloud                      # stop it and delete its data, keep the run
control stack rm cloud                         # forget a stopped run
```

Data survives `stop` and `restart`: infrastructure and any member that declares
`volumes` (a map of volume name to container path) keep named Docker volumes.
`stack clean` stops the run and deletes those volumes but keeps the run registered and its
synced workspace, so the next start comes up empty and fast.

`--name` defaults to the stack identifier and must be unique; the run is registered as
`stack-<name>` and shows up in `control ls`, the daemon API and the web UI next to the
workspaces. Address it with `--stack <name>` on `logs`, `status`, `restart`, `tui`, `open`
and `sh`, for example `control logs --stack cloud auth-core --follow`.

A development run starts the shared infrastructure the members declare, creates their
databases, then starts one `app` container that syncs the checkout into a volume, installs,
builds and supervises one bun process per member (`scripts/dev-tools/stack/runner.ts`).
Source edits are re-synced every few seconds, so each service's own watcher reloads. A
production run starts one container per member. Containers share the network namespace of
a `gateway` container that forwards the fixed development ports to the infrastructure
containers and carries the `metorial-stack-<name>.localhost` hostname, so environment
values resolve the same way they do for a host workspace. The shared hostname proxy routes
the endpoint ports to the stack.

## Build cache

The daemon starts the Warp Cache (`src/tooling/warp-cache`), a Turborepo remote-cache server, backed by `~/.metorial-control-dev-service/cache`, and exports `TURBO_API`, `TURBO_TEAM` and `TURBO_TOKEN` so every Turbo run that Control spawns uses it. The token is generated on each daemon start and the server stops with the daemon. Stack containers reach it at `host.docker.internal`. Set `CONTROL_CACHE=0` to disable it or `CONTROL_CACHE_PORT` (default 8787) to move it; if the port is taken the daemon logs a warning and continues without it. Server output goes to `cache.log` in the Control home.

## Hot reload of definitions

While a workspace is running, the daemon watches every `control/` directory and
the `@metorial/control` sources. A change re-evaluates all definitions; a failed
evaluation is logged and the running configuration is kept. Services whose
command, working directory, environment or dependencies differ are restarted,
new run commands are started, removed ones are stopped, and endpoint changes
re-register the proxy routes. Infrastructure, database and prepare changes are
reported and need a workspace restart.

## Workspace runtimes

New workspaces currently always use the host runtime:

```sh
control workspace create feature/my-change
```

The Docker workspace implementation is retained for existing workspaces but is
not selectable through the CLI. Existing workspace metadata without a runtime
is still treated as `docker` for compatibility.

For a host workspace, `workspace start` starts its generated dependency stack,
ensures host setup is current, and opens the local worktree in VS Code.
`workspace dev` and `workspace shell` execute from the worktree on the host.
`workspace stop` retains dependency data, while `workspace stop --volumes`
removes it. `--rebuild` is Docker-only. Host mode requires Bun, Docker, and the `code` shell command to be installed locally.
Rust remains part of the development container toolchain for application packages;
Control itself runs entirely in TypeScript.

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
22/npm, the checkout-aware `control` launcher, Go 1.25, Rust 1.91.1,
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
`.control`, Prisma, and frontend files remain in the worktree so the
editor and container see the same output. The source checkout's `env.json` is
mounted read-only when a worktree does not provide its own override.

A single global Traefik container owns the declared HTTP ports and routes each
request by host header. A workspace for branch `feature/auth` therefore uses
URLs such as:

```text
http://metorial-feature-auth.localhost:4310
http://metorial-feature-auth.localhost:4300
```

Port 80 on the workspace hostname redirects to the same host on port 4300, so
`http://metorial-feature-auth.localhost/` is equivalent to
`http://metorial-feature-auth.localhost:4300/`.

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

## Generated Dockerfiles

Images are built from Dockerfiles that control generates from a `build` spec in a
service's `control/index.ts` (`bunService(...)` from `@metorial/control`, set on a
`ciImage` or a `dockerfile()` definition). The output is written beside the
package as `Dockerfile` and committed; do not edit it by hand.

```sh
control docker generate          # write all Dockerfiles
control docker generate --check  # fail if any are out of date (CI)
```

They are also regenerated on every `control dev` start and whenever a manifest
changes while the daemon runs. Images run as the unprivileged `metorial` user
under `tini`, and database migrations run at startup through `control-runtime`
(`oss/src/tooling/control/runtime`) from the `migrations` listed in the spec
(`migrations.core`, `ownMigration(...)`, ...).

Further `bunService` options:

- `buildEnv`: `ENV` set in the builder stage (for example `METORIAL_EDITION`).
- `sources`: workspace paths copied into the builder next to the pruned workspace
  (files the prune step does not include, such as shared tsconfigs or scripts).
- `strip`: package names removed from `node_modules` after install.
- `assets`: `from` is relative to the package; a leading `/` makes it relative to
  the workspace root and then requires an explicit `to`.
- `generateFirst`: run `prisma:generate` as its own Turbo run before the other tasks
  (needed when a package's build is not ordered after generation by Turbo).
- `runtime: 'source'`: the image keeps the builder stage and runs `start` from the
  package directory instead of a bundled `dist`.
- `release` bakes `METORIAL_RELEASE_CHANNEL` (build arg, default `dev`); `versioned`
  also sets `METORIAL_VERSION` from the `METORIAL_BUILD_VERSION` build arg.

Stack-only manifests (such as the on-prem services) are generated too.
`control stack images <stack> --json` lists the images a production stack builds.
