import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/client';
import { afterAll } from 'vitest';
import { setupPrismaTestDb, setupTestGlobals } from '@lowerdeck/testing-tools';
import { defaultProvider } from '../services/provider';

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
  await testDb.provider.create({
    data: {
      oid: defaultProvider.oid,
      id: defaultProvider.id,
      identifier: defaultProvider.identifier,
      name: defaultProvider.name
    }
  });
};
