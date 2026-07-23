import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/client';
import { afterAll } from 'vitest';
import { setupPrismaTestDb, setupTestGlobals } from '@lowerdeck/testing-tools';
import { env } from '../env';
import { defaultProvider } from '../services/provider';
import { storage } from '../storage';

setupTestGlobals({ nodeEnv: 'test' });

const db = await setupPrismaTestDb<PrismaClient>({
  guard: 'forge-test',
  prismaClientFactory: url => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
});

afterAll(async () => {
  await db.disconnect();
});

export const testDb: PrismaClient = db.client;

// Clean database and re-seed the provider with the same oid/id as the cached provider
export const cleanDatabase = async () => {
  await db.clean();
  await storage.upsertBucket(env.storage.LOG_BUCKET_NAME);
  await storage.upsertBucket(env.storage.ARTIFACT_BUCKET_NAME);
  await testDb.provider.create({
    data: {
      oid: defaultProvider.oid,
      id: defaultProvider.id,
      identifier: defaultProvider.identifier,
      name: defaultProvider.name
    }
  });
};
