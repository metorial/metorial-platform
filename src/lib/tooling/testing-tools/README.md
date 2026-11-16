# `@lowerdeck/testing-tools`

Opinionated testing utilities for Vitest configuration, environment loading, Prisma test databases, factories, and HTTP helpers.

## Installation

```bash
npm install @lowerdeck/testing-tools
```

```bash
yarn add @lowerdeck/testing-tools
```

```bash
bun add @lowerdeck/testing-tools
```

```bash
pnpm add @lowerdeck/testing-tools
```

## Usage

### Vitest config

```typescript
import { createVitestConfig, loadTestEnv, withAliases } from '@lowerdeck/testing-tools';
// In CI, run Vitest with `--mode ci` to load `.env.ci` via loadTestEnv.

loadTestEnv();

const config = withAliases(createVitestConfig(), { '@': './src' });

export default config;
```

### Prisma test database helpers

Use `setupPrismaTestDb` in `setupFiles` (runs before the Vitest runner),
and `withTestDb` inside test files when you want hook-based cleanup.

```typescript
// vitest.setup.ts (setupFiles)
import { setupPrismaTestDb } from '@lowerdeck/testing-tools';
import { PrismaClient } from '@prisma/client';

const db = await setupPrismaTestDb({
  prismaClientFactory: url => new PrismaClient({ datasourceUrl: url }),
  guard: 'test'
});

export const testDb = db.client;
export const cleanDatabase = db.clean;
```

Call `db.disconnect()` in an `afterAll` hook when the test process shuts down.

```typescript
// inside a test file usage
import { withTestDb } from '@lowerdeck/testing-tools';
import { PrismaClient } from '@prisma/client';

const { client } = withTestDb({
  prismaClientFactory: url => new PrismaClient({ datasourceUrl: url }),
  guard: 'test',
  cleanBeforeEach: true
});
```

### Factories

```typescript
import { defineFactory } from '@lowerdeck/testing-tools';

type User = { name: string; email: string };

const userFactory = defineFactory<User>(
  () => ({ name: 'Ada', email: 'ada@example.com' }),
  {
    persist: async user => user
  }
);
```

### HTTP test helpers

```typescript
import { createTestServer } from '@lowerdeck/testing-tools';

const server = createTestServer({
  request: async path => new Response(`ok:${path}`)
});

await server.get('/health');
```

### E2E helpers

```typescript
import { createE2EVitestConfig, eventually, uniqueId } from '@lowerdeck/testing-tools';

export default createE2EVitestConfig();

let name = uniqueId('store');

await eventually(async () => {
  expect(await countJobs()).toBe(1);
}, { timeoutMs: 10_000, intervalMs: 250 });
```

`createE2EVitestConfig()` runs `e2e/**/*.e2e.ts` serially with 60s test and 120s hook timeouts
and fails when no tests are found; the `.e2e.ts` suffix keeps unit runs from picking them up.
`eventually` retries an assertion until it passes or the timeout elapses (for queue- or
worker-driven side effects). `uniqueId` returns collision-free names so suites can share
databases without cleanup.

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
