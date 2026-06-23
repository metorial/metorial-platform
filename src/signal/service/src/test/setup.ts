import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/client';
import { afterAll } from 'vitest';
import { setupPrismaTestDb, setupTestGlobals } from '@lowerdeck/testing-tools';

setupTestGlobals({ nodeEnv: 'test' });

const db = await setupPrismaTestDb<PrismaClient>({
  guard: 'signal-test',
  prismaClientFactory: url => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
});

afterAll(async () => {
  await db.disconnect();
});

export const testDb: PrismaClient = db.client;
export const cleanDatabase = db.clean;
