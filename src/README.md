# OSS source structure

The OSS source tree groups code by product and team ownership while allowing the Metorial
monolith to span every product. Each product owns its standalone services, shared product
packages, and the modules that run inside the monolith.

The refactor is in progress. Runtime's move into `products/runtime` is complete, and agents has
started moving into `products/agents`. Other code still lives in the previous layout. The tree
below defines the target structure; it does not imply that every directory has already moved.

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
      core/
        packages/
          <package-name>/
        modules/
          <module-name>/
      clients/                  # Optional service clients
      data/                     # Optional product data and generators
      deployment/               # Optional product deployment resources
      e2e/                      # Optional tests spanning product components
  platform/
    services/
      <service-name>/
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

Create only the directories a product or service needs. Additional folders such as `clients`,
`data`, `deployment`, `spec`, and `e2e` are allowed when their purpose and owner are clear.

## Products and ownership

Each directory under `products/` represents a core product owned by one team. That team owns the
product's service implementations, monolith modules, supporting packages, and product-specific
resources. A product can have standalone services, monolith code, or both.

Place code at the narrowest scope that matches its responsibility:

| Responsibility                                                 | Location                                     |
| -------------------------------------------------------------- | -------------------------------------------- |
| A service owned by a product team                              | `products/<product>/services/<service>`      |
| Utilities private to one service                               | That service's `packages/`                   |
| Product packages shared by services and/or the monolith        | `products/<product>/packages/<package>`      |
| Product business logic running in the Metorial monolith        | `products/<product>/core/modules/<module>`   |
| Utilities shared within that product's monolith code           | `products/<product>/core/packages/<package>` |
| A shared service supporting multiple products                  | `platform/services/<service>`                |
| The main Metorial database                                     | `platform/db`                                |
| A shared API used across products                              | `platform/apis/<api>`                        |
| Metorial-specific API composition and presenters               | `surfaces/metorial/`                         |
| Frontend applications and their shared UI packages             | `frontends/metorial/`                        |
| Development and repository tools                               | `tooling/`                                   |
| Generic utilities without product or Metorial domain knowledge | `lib/<group>/<package>`                      |

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
when multiple services or the product's monolith code need them. Clients may live in the
product's `clients/` directory, as they do in runtime.

Service-owned databases remain with their services. Moving the main Metorial database to
`platform/db` does not merge the existing independent databases.

## The Metorial monolith

`products/<product>/core/` contains the part of a product that runs inside the Metorial monolith.
Here, `core` describes where code runs; it does not assign that code to a separate product or
team. Each product team continues to own its modules and packages.

The shared monolith entry point composes modules from multiple products, mounts their API
surfaces, imports lifecycle listeners, and registers background processors. Product boundaries
do not require a separate process or deployment for each product. The current
`metorial/services/api` already composes APIs and workers across products; the refactor preserves
that model while relocating the code it consumes.

Product core modules may use their product's shared packages, call services owned by that
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
Internal APIs belonging to a standalone service stay in that service's `apis/` directory.

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

| Area                           | Status                                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime                        | Structural move complete under `products/runtime`, including services, clients, and shared packages. This status concerns directory organization, not every runtime feature or deployment change. |
| Agents                         | Started: the model catalog is under `products/agents/data/models`; other agents code remains in the previous tree.                                                                                |
| Other products and shared code | Migration continues. Product modules, APIs, presenters, the main database, frontends, and generic libraries still have legacy locations.                                                          |

As remaining code moves, use these destination rules:

| Current location                                                      | Target placement                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `metorial/products/<product>/modules/`                                | `products/<product>/core/modules/` for monolith modules                                    |
| `metorial/products/<product>/packages/`                               | Product `packages/` or `core/packages/`, according to consumers                            |
| Standalone services at the source root or inside the old product tree | Product `services/` or `platform/services/`, according to ownership                        |
| `metorial/db/`                                                        | `platform/db/`                                                                             |
| `metorial/apis/`                                                      | `surfaces/metorial/apis/` or `platform/apis/`, according to responsibility                 |
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
