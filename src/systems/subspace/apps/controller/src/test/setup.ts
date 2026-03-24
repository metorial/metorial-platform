import { setupPrismaTestDb, setupTestGlobals } from '@lowerdeck/testing-tools';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@metorial-subspace/db';
import { sessionMessageBucketRecord } from '@metorial-subspace/connection-utils';
import { afterAll } from 'vitest';
import { setupVoyagerStub, resetVoyagerStub } from './helpers/voyagerStub';

setupTestGlobals({ nodeEnv: 'test' });
setupVoyagerStub();

let db = await setupPrismaTestDb<PrismaClient>({
  guard: 'subspace-test',
  prismaClientFactory: url => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
});

afterAll(async () => {
  await db.disconnect();
});

const ensureSessionMessageBucket = async () => {
  await db.client.sessionMessageStorageBucket.upsert({
    where: { bucket: sessionMessageBucketRecord.bucket },
    update: {},
    create: {
      oid: sessionMessageBucketRecord.oid,
      bucket: sessionMessageBucketRecord.bucket
    }
  });
};

await ensureSessionMessageBucket();

export let testDb = db.client;
export let cleanDatabase = async () => {
  await db.clean();
  resetVoyagerStub();
  await ensureSessionMessageBucket();
};
