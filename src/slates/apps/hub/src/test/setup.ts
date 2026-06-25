import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/client';
import { afterAll } from 'vitest';
import { createPrismaTestDb, setupTestGlobals } from '@lowerdeck/testing-tools';

setupTestGlobals({ nodeEnv: 'test' });

let db = createPrismaTestDb<PrismaClient>({
  guard: 'slates-hub-test',
  prismaClientFactory: url => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
});

export let testDb: PrismaClient = db.client;

let wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let isRetryableCleanError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;

  let maybeError = error as {
    code?: string;
    meta?: { code?: string };
  };

  return (
    maybeError.code === '40P01' ||
    maybeError.code === '40001' ||
    maybeError.meta?.code === '40P01' ||
    maybeError.meta?.code === '40001'
  );
};

export let cleanDatabase = async () => {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await testDb.$transaction(
        async tx => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(843728401)`;

          let tables = await tx.$queryRaw<{ tablename: string }[]>`
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
          `;

          let tableNames = tables
            .map(table => `"${table.tablename.replace(/"/g, '""')}"`)
            .join(', ');

          if (tableNames.length === 0) return;

          await tx.$executeRawUnsafe(
            `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`
          );
        },
        { timeout: 30_000 }
      );
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableCleanError(error) || attempt === 2) throw error;
      await wait(100 * 2 ** attempt);
    }
  }

  throw lastError;
};

await db.connect();
await cleanDatabase();

afterAll(async () => {
  await db.disconnect();
});

