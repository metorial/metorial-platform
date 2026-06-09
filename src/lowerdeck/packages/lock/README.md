# `@lowerdeck/lock`

Distributed locking using Redlock for Redis. Ensures atomic operations across multiple instances with automatic lock extension and retry logic.

## Installation

```bash
npm install @lowerdeck/lock
yarn add @lowerdeck/lock
bun add @lowerdeck/lock
pnpm add @lowerdeck/lock
```

## Usage

```typescript
import { createLock } from '@lowerdeck/lock';

const lock = createLock({
  name: 'my-service',
  redisUrl: 'redis://localhost:6379'
});

// Use lock to ensure only one instance runs a critical section
await lock.usingLock('resource-key', async ({ passForNow }) => {
  console.log('Inside critical section');

  // If you want to pass on this execution and retry later
  if (shouldSkip) {
    passForNow();
    return;
  }

  await performCriticalOperation();
});

// Ensure a function runs only once across all instances
await lock.doOnce('unique-task-id', async () => {
  console.log('This will run on only one instance');
  await oneTimeSetup();
});
// Other instances will wait and return null

// Run once and share the result with other instances
const result = await lock.doOnceAndReturn('compute-key', async () => {
  console.log('Computing expensive result once');
  return await expensiveComputation();
});
// First instance computes and caches, others get cached result

// Lock multiple resources at once
await lock.usingLock(['user:123', 'account:456'], async () => {
  await transferFunds();
});
```

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
