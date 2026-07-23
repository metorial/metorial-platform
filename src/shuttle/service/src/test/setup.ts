import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/client';
import { afterAll, vi } from 'vitest';
import { setupPrismaTestDb, setupTestGlobals } from '@lowerdeck/testing-tools';
import { getId } from '../id';
import { connectionLogsBucketRecord } from '../storage';

// Mock `hono/bun` for compatibility with Vitest's Node runner (`Bun` is undefined error)
vi.mock('hono/bun', () => ({
  upgradeWebSocket: (handler: any) => handler,
  websocket: {}
}));

setupTestGlobals({ nodeEnv: 'test' });

const functionBayProviderSeed = {
  ...getId('deploymentProvider'),
  identifier: 'function-bay',
  name: 'Function Bay'
};

const db = await setupPrismaTestDb<PrismaClient>({
  guard: 'shuttle-test',
  prismaClientFactory: url => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
});

afterAll(async () => {
  await db.disconnect();
});

export const testDb: PrismaClient = db.client;

// Clean database and re-seed the provider with the same oid that production code expects
export const cleanDatabase = async () => {
  await db.clean();
  await testDb.deploymentProvider.upsert({
    where: { identifier: functionBayProviderSeed.identifier },
    create: {
      oid: functionBayProviderSeed.oid,
      id: functionBayProviderSeed.id,
      identifier: functionBayProviderSeed.identifier,
      name: functionBayProviderSeed.name
    },
    update: {}
  });
  await testDb.connectionLogsStorageBucket.upsert({
    where: { bucket: connectionLogsBucketRecord.bucket },
    create: {
      oid: connectionLogsBucketRecord.oid,
      bucket: connectionLogsBucketRecord.bucket
    },
    update: {}
  });
};
