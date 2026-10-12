# `@lowerdeck/execution-context`

Track and manage execution context for requests, scheduled jobs, and background tasks. Provides type-safe context objects for different execution environments with support for parent-child relationships.

## Installation

```bash
npm install @lowerdeck/execution-context
yarn add @lowerdeck/execution-context
bun add @lowerdeck/execution-context
pnpm add @lowerdeck/execution-context
```

## Usage

```typescript
import { createExecutionContext, ExecutionContext } from '@lowerdeck/execution-context';

// Create context for an HTTP request
const requestContext = createExecutionContext({
  type: 'request',
  userId: 'user_123',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});

// Create context for a scheduled job
const cronContext = createExecutionContext({
  type: 'scheduled',
  cron: '0 0 * * *',
  name: 'daily-cleanup'
});

// Create context for a queue job
const jobContext = createExecutionContext({
  type: 'job',
  queue: 'emails'
});

// Nest contexts with parent relationships
const childContext = createExecutionContext({
  type: 'job',
  queue: 'notifications',
  parent: requestContext
});

console.log(childContext.contextId); // Auto-generated ID
```

## Providing a context

`provideExecutionContext(context, callback)` runs the callback and its after hooks in
separate Sentry scopes. Concurrent requests and jobs cannot replace each other's
execution-context metadata, and nested work restores its parent's scope when it finishes.
Standalone scheduled and queue work starts a fresh trace. Work with an explicit parent
or incoming trace parent continues that trace.

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
