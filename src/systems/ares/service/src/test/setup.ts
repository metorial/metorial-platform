import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/client';
import { afterAll } from 'vitest';
import { setupPrismaTestDb, setupTestGlobals } from '@lowerdeck/testing-tools';

setupTestGlobals({ nodeEnv: 'test' });

let db = await setupPrismaTestDb<PrismaClient>({
  guard: 'ares-test',
  prismaClientFactory: url => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
});

globalThis.__ARES_TEST_DB__ = db.client;

afterAll(async () => {
  await db.disconnect();
  globalThis.__ARES_TEST_DB__ = undefined;
});

export let testDb: PrismaClient = db.client;
export let cleanDatabase = db.clean;
