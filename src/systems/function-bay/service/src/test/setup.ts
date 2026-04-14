import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/client';
import { afterAll } from 'vitest';
import { setupPrismaTestDb, setupTestGlobals } from '@lowerdeck/testing-tools';
import { provider } from '../providers/aws-lambda/provider';

setupTestGlobals({ nodeEnv: 'test' });

const db = await setupPrismaTestDb<PrismaClient>({
  guard: 'function-bay-test',
  prismaClientFactory: url => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
});

afterAll(async () => {
  await db.disconnect();
});

export const testDb: PrismaClient = db.client;

// Clean database and re-seed the provider with the same oid that production code expects
export const cleanDatabase = async () => {
  await db.clean();
  // Re-create provider with the cached oid from production code
  await testDb.provider.upsert({
    where: { identifier: provider.identifier },
    create: {
      oid: provider.oid,
      id: provider.id,
      identifier: provider.identifier,
      name: provider.name
    },
    update: {}
  });
};
