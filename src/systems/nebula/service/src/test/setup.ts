import { PrismaPg } from '@prisma/adapter-pg';
import { setupPrismaTestDb, setupTestGlobals } from '@lowerdeck/testing-tools';
import { afterAll, vi } from 'vitest';
import { PrismaClient } from '../../prisma/generated/client';
import { dataKeyCache } from '../lib/dataKeyCache';

setupTestGlobals({ nodeEnv: 'test' });

vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({
    usingLock: async (_key: string, fn: () => Promise<any>) => await fn()
  })
}));

let db = await setupPrismaTestDb<PrismaClient>({
  guard: 'nebula-test',
  prismaClientFactory: url => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
});

afterAll(async () => {
  await db.disconnect();
});

export let testDb: PrismaClient = db.client;

export let cleanDatabase = async () => {
  dataKeyCache.clear();
  await db.clean();
};
