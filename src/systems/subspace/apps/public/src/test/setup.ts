import { setupPrismaTestDb, setupTestGlobals } from '@lowerdeck/testing-tools';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@metorial-subspace/db';
import { afterAll } from 'vitest';

setupTestGlobals({ nodeEnv: 'test' });

let db = await setupPrismaTestDb<PrismaClient>({
  guard: 'subspace-test',
  prismaClientFactory: url => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
});

afterAll(async () => {
  await db.disconnect();
});

export let testDb = db.client;
export let cleanDatabase = db.clean;
