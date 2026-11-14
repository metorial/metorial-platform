# OSS source structure

The OSS source tree groups code by product and team ownership while allowing the Metorial
monolith to span every product. Each product owns its standalone services, shared product
packages, and the modules that run inside the monolith.

The refactor is in progress. Runtime’s move is complete. Agents, auditing, identity, skills,
storage, and workforce now live under `products/`. The layout below also covers code still in
the previous tree.

**All new packages, modules, and services must follow this specification**, including additions
to products whose existing code has not yet migrated. Existing paths describe migration state,
not the placement rules for new code.

This specification covers `oss/src/`. Restructuring the enterprise source tree is outside its
current scope. OSS code must continue to be independent of enterprise code.

## Target layout

```text
oss/src/
  products/
    <product-name>/
      services/
        <service-name>/
      packages/
        <package-name>/
      apis/
        <api-name>/             # APIs owned by this product
      modules/
        <module-name>/          # Product modules running in the Metorial monolith
      clients/
        <client-name>/          # Clients for this product's services
      data/                     # Optional product data and generators
      deployment/               # Optional product deployment resources
      e2e/                      # Optional tests spanning product components
  platform/
    services/
      <service-name>/
    clients/
      <client-name>/            # Clients for shared platform services
    db/                         # Main Metorial database package
    apis/                       # Shared APIs, such as files
  frontends/
    metorial/                   # Current metorial-frontend contents
  surfaces/
    metorial/
      apis/                     # Metorial-specific API packages
      presenters/               # Metorial-specific representations
  tooling/
  lib/
    <group>/                    # For example crypto, rpc, or http
      <package-name>/
```

Create only the directories a product or service needs. Additional folders such as `data`,
`deployment`, `implementation`, `spec`, and `e2e` are allowed when their purpose and owner are
clear. Service clients must live in the owning product's `clients/` directory or in `platform/clients/`.

## Products and ownership

Each directory under `products/` represents a core product owned by one team. That team owns the
product's service implementations, monolith modules, supporting packages, and product-specific
resources. A product can have standalone services, monolith code, or both.

Place code at the narrowest scope that matches its responsibility:

| Responsibility                                                 | Location                                                             |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| A service owned by a product team                              | `products/<product>/services/<service>`                              |
| Clients for product or platform services                       | `products/<product>/clients/<client>` or `platform/clients/<client>` |
| Utilities private to one service                               | That service's `packages/`                                           |
| Product packages shared by services and/or the monolith        | `products/<product>/packages/<package>`                              |
| Product business logic running in the Metorial monolith        | `products/<product>/modules/<module>`                                |
| An API owned by a product team                                 | `products/<product>/apis/<api>`                                      |
| A shared service supporting multiple products                  | `platform/services/<service>`                                        |
| The main Metorial database                                     | `platform/db`                                                        |
| A shared API used across products                              | `platform/apis/<api>`                                                |
| Metorial-specific API composition and presenters               | `surfaces/metorial/`                                                 |
| Frontend applications and their shared UI packages             | `frontends/metorial/`                                                |
| Development and repository tools                               | `tooling/`                                                           |
| Generic utilities without product or Metorial domain knowledge | `lib/<group>/<package>`                                              |

Sharing a product capability with another product does not transfer its ownership. Keep it with
the owning product and expose it through a package or service client. Use `platform` for
capabilities whose responsibility is shared infrastructure across products.

## Services

A service directory is an ownership boundary. Small services can be a single self-contained
package. Services composed of multiple packages use the following layout, under either
`products/<product>/services/` or `platform/services/`:

```text
<service-name>/
  db/                           # Service-owned Prisma database package, if needed
  packages/
    <package-name>/              # Utilities shared within this service
  modules/
    <module-name>/              # Business logic packages
  apis/
    <api-name>/                  # API packages
  service/                      # One runnable entry point
  # Or services/<entry-name>/ for multiple runnable entry points
```

Use `service/` for one entry point and `services/` for multiple entry points, such as an API and
a worker. A self-contained service does not need to split its database, API, or helpers into
separate packages solely to match this example.

Keep service-specific packages inside the service. Move packages to the product's `packages/`
when multiple services or the product's monolith code need them.

Place service clients alongside the owning product's or platform's `services/` directory:
`products/<product>/clients/<client-name>/` or `platform/clients/<client-name>/`. Clients must not
live inside individual service directories. Use the service name for the client directory; add a
purpose suffix when a service exposes multiple clients. Package names remain governed by the
service package naming convention below.

Service-owned databases remain with their services. Moving the main Metorial database to
`platform/db` does not merge the existing independent databases.

### Service package names

New service packages use the `@mtsrc` scope and a shared service name prefix:
`@mtsrc/<service-name>-<role>`. The directory describes ownership and the package name describes
the service and the package's role. Apply this convention to services under both products and
platform. Service names must be unique across products and platform because they share this
package scope.

| Role                                         | Package name                            | Location relative to the owning product or platform |
| -------------------------------------------- | --------------------------------------- | --------------------------------------------------- |
| Database, Prisma client, IDs, and migrations | `@mtsrc/<service-name>-db`              | `services/<service-name>/db/`                       |
| Internal API and its RPC contract            | `@mtsrc/<service-name>-api-internal`    | `services/<service-name>/apis/internal/`            |
| Runnable service host                        | `@mtsrc/<service-name>-service`         | `services/<service-name>/service/`                  |
| Internal API client                          | `@mtsrc/<service-name>-client-internal` | `clients/<client-name>/`                            |

For example, the agents product owns `products/agents/services/ai-gateway/`, with packages
`@mtsrc/ai-gateway-db`, `@mtsrc/ai-gateway-api-internal`, and `@mtsrc/ai-gateway-service`. Its
`@mtsrc/ai-gateway-client-internal` package lives at `products/agents/clients/ai-gateway/`.

SCM uses `services/api`, `services/code-bucket`, and `services/code-workspace` under
`products/storage/services/scm/`. Their packages are `@mtsrc/scm-service`,
`@mtsrc/scm-code-bucket-service`, and `@mtsrc/scm-code-workspace`. Its clients are
`@mtsrc/scm-client-internal` and `@mtsrc/scm-code-bucket-client-internal`, under
`products/storage/clients/{scm,code-bucket}/`.

The service host composes API packages and starts listeners and workers. The database package
owns Prisma generation and migrations; other packages import its public exports. Clients depend
on the API contract rather than the runnable service. Runtime imports between packages use
package names. Clients may use type-only relative imports of API contracts to bundle those types
into their declarations; keep the contract package declared as a dependency.

Existing services may retain legacy package names until explicitly migrated. A package rename
does not require renaming its database, environment variables, protocol paths, or published
container images in the same change.

## The Metorial monolith

`products/<product>/modules/` contains the parts of a product that run inside the Metorial
monolith. Each product team owns its modules and packages.

The shared monolith entry point composes modules from multiple products, mounts their API
surfaces, imports lifecycle listeners, and registers background processors. Product boundaries
do not require a separate process or deployment for each product. The current
`metorial/services/api` already composes APIs and workers across products; the refactor preserves
that model while relocating the code it consumes.

Product modules may use their product's shared packages, call services owned by that
product, and use platform services. Consume standalone services through their client or public
contract. Dependencies between monolith modules use their public package exports, following the
existing module conventions.

Modules keep their existing internal anatomy: `src/index.ts`, `src/env.ts`, `services/`,
`internal/`, `lib/`, and optional `definitions/`, `queues/`, and `cron/`. The new structure changes
their location, not the module conventions. A module's `src/services/` contains business logic;
it is distinct from the runnable services grouped at the product level.

## Platform and surfaces

`platform/` holds shared infrastructure: services used across products, the main Metorial
database, and shared APIs such as files. Platform components need explicit ownership just as
product components do.

`surfaces/metorial/` holds the APIs and presenters that expose product capabilities through
Metorial. Controllers validate requests and call modules or services; business logic stays with
the owning product. Presenters define the Metorial-facing representation of those capabilities.
Product-owned APIs live in `products/<product>/apis/`. Internal APIs belonging to a standalone
service stay in that service's `apis/` directory.

Keep shared platform API behavior in `platform/apis/` and Metorial-specific routes, composition,
and representations in `surfaces/metorial/`. A surface can compose capabilities from several
products without taking ownership of their implementations.

## Frontends tooling and libraries

`frontends/metorial/` takes over the role of `metorial-frontend/`, preserving its internal
application and package organization. `tooling/` retains its current purpose for development
and repository tools.

`lib/` groups generic packages by technical area, such as `crypto`, `rpc`, or `http`. This is the
target home for domain-free primitives currently grouped under `lowerdeck/`. These packages must
remain independent of product business logic, Metorial surfaces, and frontend applications.
Changing a package's directory does not by itself require changing its package name or scope.

## Migration status and rules

| Area                            | Status                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime                         | Structural move complete under `products/runtime`, including services, clients, and shared packages. This status concerns directory organization, not every runtime feature or deployment change.                                                                                                           |
| Agents                          | Modules and shared packages live alongside the model catalog and AI Gateway under `products/agents/`.                                                                                                                                                                                                       |
| Auditing, skills, and workforce | Modules and shared packages live under their product directories.                                                                                                                                                                                                                                           |
| Storage                         | Storage modules and SCM live under `products/storage/`. SCM, formerly Origin, uses `@mtsrc/scm-*` packages. Code Bucket and the editor live with the service. The SCM and Code Bucket clients live in `products/storage/clients/`.                                                                          |
| Identity                        | Auth Core, formerly Ares, lives at `products/identity/services/auth-core/service` (`@mtsrc/auth-core-service`). Its client is at `products/identity/clients/auth-core` (`@mtsrc/auth-core-client-internal`). The five identity modules are in `products/identity/modules` and run in the Metorial monolith. |
| Outpost                         | API at `products/outpost/apis/outpost-api/`, monolith module at `products/outpost/modules/outpost/`, and the implementation submodule at `products/outpost/implementation/`. Existing package names are retained.                                                                                           |
| Platform services               | `secret-store`, `email`, and `search` live under `platform/services/`, with clients under `platform/clients/`. Both use the `@mtsrc/<service-name>-<role>` convention.                                                                                                                                      |
| Other products and shared code  | Migration continues. Product modules, APIs, presenters, the main database, frontends, and generic libraries still have legacy locations.                                                                                                                                                                    |

As remaining code moves, use these destination rules:

| Current location                                                      | Target placement                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `metorial/products/<product>/modules/`                                | `products/<product>/modules/`                                                              |
| `metorial/products/<product>/packages/`                               | Product `packages/`                                                                        |
| Standalone services at the source root or inside the old product tree | Product `services/` or `platform/services/`, according to ownership                        |
| `metorial/db/`                                                        | `platform/db/`                                                                             |
| `metorial/apis/`                                                      | `products/<product>/apis/`, `surfaces/metorial/apis/`, or `platform/apis/`, according to ownership |
| `metorial/presenters/`                                                | `surfaces/metorial/presenters/`                                                            |
| `metorial/packages/`                                                  | The owning product, shared platform infrastructure, or `lib/`, according to responsibility |
| `metorial-frontend/`                                                  | `frontends/metorial/`                                                                      |
| `lowerdeck/`                                                          | `lib/<group>/`, grouped by technical area                                                  |
| `tooling/`                                                            | Remains `tooling/`                                                                         |

Migrate existing code incrementally. Existing packages may remain at their current paths until
their migration; new packages, modules, and services must use the target layout immediately.
New code may depend on existing packages through their public contracts during the transition.

Each move must update workspace discovery, imports and path references, build configuration,
development orchestration, deployment references, and tests as applicable. Include references
from the enterprise checkout when it consumes the moved OSS packages. Preserve package names
and external contracts unless renaming them is an explicit part of the change.

Keep the codebase structure map and relevant skills aligned with completed moves. Until the
migration finishes, use this specification for placement and the current tree to locate code.
Existing coding, module, database, API, and testing conventions continue to apply.
