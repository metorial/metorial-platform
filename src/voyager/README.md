# Voyager

Voyager is a multi-tenant search and indexing service that provides full-text search and structured data filtering capabilities. It organizes documents in hierarchical indexes and searches them efficiently with tenant isolation.

## Features

- **Multi-Tenant Architecture**: Complete tenant isolation with tenant-specific record filtering
- **Hierarchical Organization**: Source, Index, and Record hierarchy for logical data organization
- **Full-Text Search**: PostgreSQL-based full-text search with English language support
- **Structured Data Filtering**: JSON/JSONB filtering on document fields
- **Asynchronous Processing**: Queue-based indexing and deletion for high throughput
- **Document Versioning**: Hash-based change detection prevents duplicate indexing
- **Tenant-Specific Records**: Records can be associated with specific tenants or made globally available
- **Metadata Support**: Store additional metadata alongside searchable content

## Quick Start

### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: voyager
      POSTGRES_PASSWORD: voyager
      POSTGRES_DB: voyager
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - voyager-network

  postgres-search:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: voyager
      POSTGRES_PASSWORD: voyager
      POSTGRES_DB: voyager-search
    volumes:
      - postgres_search_data:/var/lib/postgresql/data
    networks:
      - voyager-network

  redis:
    image: redis:7-alpine
    networks:
      - voyager-network

  voyager:
    image: ghcr.io/metorial/voyager:latest
    ports:
      - "52060:52060"
    environment:
      DATABASE_URL: postgresql://voyager:voyager@postgres:5432/voyager
      SEARCH_DATABASE_URL: postgresql://voyager:voyager@postgres-search:5432/voyager-search
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - postgres
      - postgres-search
      - redis
    networks:
      - voyager-network

volumes:
  postgres_data:
  postgres_search_data:

networks:
  voyager-network:
    driver: bridge
```

Start the services:

```bash
docker-compose up -d
```

The Voyager service will be available at `http://localhost:52060`

## TypeScript Client

### Installation

```bash
npm install @metorial-services/voyager-client
yarn add @metorial-services/voyager-client
bun add @metorial-services/voyager-client
```

### Basic Usage

```typescript
import { createVoyagerClient } from '@metorial-services/voyager-client';

let client = createVoyagerClient({
  endpoint: 'http://localhost:52060',
});
```

### Core API Examples

#### 1. Tenant Management

Tenants provide isolation for multi-tenant applications:

```typescript
// Create/update a tenant
let tenant = await client.tenant.upsert({
  name: 'Acme Corporation',
  identifier: 'acme-corp',
});

// Get a tenant
let retrievedTenant = await client.tenant.get({
  tenantId: tenant.id,
});
```

#### 2. Source Management

Sources are top-level containers for organizing related indexes:

```typescript
// Create/update a source
let source = await client.source.upsert({
  name: 'Documentation',
  identifier: 'docs',
});

// Get a source
let retrievedSource = await client.source.get({
  sourceId: source.id,
});
```

#### 3. Index Management

Indexes define searchable collections within a source:

```typescript
// Create/update an index
let index = await client.index.upsert({
  sourceId: source.id,
  name: 'API Reference',
  identifier: 'api-reference',
});

// Get an index
let retrievedIndex = await client.index.get({
  sourceId: source.id,
  indexId: index.id,
});
```

#### 4. Indexing Records

Add searchable documents to an index:

```typescript
// Index a document (async operation)
let record = await client.record.index({
  sourceId: source.id,
  indexId: index.id,
  documentId: 'doc-123',
  body: 'This is the searchable content of the document.',
  fields: {
    title: 'Getting Started',
    category: 'guides',
    tags: ['tutorial', 'beginner'],
  },
  metadata: {
    author: 'John Doe',
    version: '1.0',
  },
});

// Index a tenant-specific document
let tenantRecord = await client.record.index({
  sourceId: source.id,
  indexId: index.id,
  documentId: 'doc-456',
  tenantIds: [tenant.id],
  body: 'This document is only visible to specific tenants.',
  fields: {
    title: 'Private Document',
    visibility: 'private',
  },
});

// Index a document with structured body
let structuredRecord = await client.record.index({
  sourceId: source.id,
  indexId: index.id,
  documentId: 'doc-789',
  body: {
    title: 'API Documentation',
    description: 'Complete API reference',
    sections: ['authentication', 'endpoints', 'examples'],
  },
  fields: {
    type: 'api-docs',
    version: '2.0',
  },
});
```

#### 5. Searching Records

Search indexed documents with full-text queries and structured filters:

```typescript
// Basic full-text search
let results = await client.record.search({
  tenantId: tenant.id,
  sourceId: source.id,
  indexId: index.id,
  query: 'getting started tutorial',
});

for (let record of results) {
  console.log('Document ID:', record.documentId);
  console.log('Body:', record.body);
  console.log('Fields:', record.fields);
  console.log('Metadata:', record.metadata);
}

// Search with JSON field filters
let filteredResults = await client.record.search({
  tenantId: tenant.id,
  sourceId: source.id,
  indexId: index.id,
  query: 'authentication',
  filters: {
    category: 'guides',
    tags: ['tutorial'],
  },
});

// Search with complex filters
let advancedResults = await client.record.search({
  tenantId: tenant.id,
  sourceId: source.id,
  indexId: index.id,
  query: 'api endpoints',
  filters: {
    type: 'api-docs',
    version: '2.0',
  },
});
```

#### 6. Retrieving Records

Get specific records by ID:

```typescript
// Get a record
let record = await client.record.get({
  tenantId: tenant.id,
  recordId: 'record-id',
});

console.log('Document ID:', record.documentId);
console.log('Body:', record.body);
console.log('Fields:', record.fields);
console.log('Metadata:', record.metadata);
console.log('Hash:', record.hash);
console.log('Is Tenant Specific:', record.isTenantSpecific);
```

#### 7. Deleting Records

Remove documents from an index:

```typescript
// Delete records (async operation)
let result = await client.record.delete({
  sourceId: source.id,
  indexId: index.id,
  documentIds: ['doc-123', 'doc-456', 'doc-789'],
});

console.log('Success:', result.success);
```

## Architecture

Voyager uses a layered architecture:

- **Primary Database**: PostgreSQL stores tenant, source, index, and record metadata
- **Search Database**: Dedicated PostgreSQL instance with full-text search indexes
- **Message Queue**: Redis queues asynchronous indexing and deletion operations
- **Worker Processors**: Background workers consume queue tasks and update search indexes

Records are automatically deduplicated using content hashing. If a record's body and fields haven't changed, re-indexing is skipped.

## License

This project is licensed under the Apache License 2.0.
