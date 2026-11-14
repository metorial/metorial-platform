# Voyager e2e test plan

Voyager is an RPC-only service (`/metorial-voyager`), so every suite talks to it through the
typed RPC client (like forge/signal) and asserts persisted rows through `../src/db`.
The default backend is Postgres full-text search (no Algolia keys in the stack). Indexing is
asynchronous (`voy/idx`, `voy/del` queues), so search/delete effects are awaited with `eventually`.

## tenant.e2e.ts
- upsert is idempotent per identifier (one row, same id) and the presenter shape is right
- get by id and by identifier; unknown tenant rejected; missing `tenantId` rejected

## source.e2e.ts
- upsert creates, then updates `name` for the same identifier (same id, one row)
- get by id and by identifier; unknown source rejected
- identifiers are globally unique across sources

## index.e2e.ts
- upsert creates under a source; upsert again updates name only
- same identifier under two sources yields two distinct indexes (scoped by source)
- get by id / identifier; an index is not reachable through a different source (isolation)
- unknown source / unknown index rejected

## record.e2e.ts
- index: persists a row (body, fields, metadata, hash, `isTenantSpecific`), returns presenter shape
- re-index same documentId updates in place (one row), new hash when content changes, same hash for same content
- tenant-specific records: tenants are auto-created from `tenantIds` (by identifier), `tenantOids` stored, duplicates collapsed
- `get`: tenant sees own record; other tenant / unknown tenant / unknown record rejected
- validation: missing fields / bad body type rejected

## search.e2e.ts
- body full-text match (string body and object body joined)
- fuzzy/short-query handling: punctuation stripped, empty query returns everything visible
- `filters` (JSONB containment) narrow results, multiple filters AND together
- tenant visibility: no tenant -> only global records; tenant -> global + own; other tenant's records never leak
- index isolation: same query in a different index returns nothing
- `subspace_provider_listing` index prefers title (first body segment) matches
- result limit/order sanity and records returned in presenter shape

## delete.e2e.ts
- delete removes rows from the search backend (search no longer finds them) via queue, other documents survive
- deleting unknown documentIds is a no-op success; empty list is accepted
- delete is scoped to the index
