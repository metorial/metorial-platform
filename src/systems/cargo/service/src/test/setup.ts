process.env.CARGO_API_PORT ??= '52150';
process.env.CARGO_CONTENT_PORT ??= '52151';
process.env.CARGO_HEALTH_PORT ??= '12121';
process.env.OBJECT_STORAGE_URL ??= 'http://object-storage.test';
process.env.FILES_BUCKET_NAME ??= 'cargo-files-test';
process.env.DOWNLOAD_PUBLIC_URL ??= 'http://cargo-content.test';
process.env.CARGO_REGION ??= 'tst';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/client';
import { afterAll } from 'vitest';
import { setupPrismaTestDb, setupTestGlobals } from '@lowerdeck/testing-tools';

setupTestGlobals({ nodeEnv: 'test' });

let db = await setupPrismaTestDb<PrismaClient>({
  guard: 'cargo-test',
  prismaClientFactory: url =>
    new PrismaClient({
      adapter: new PrismaPg({ connectionString: url })
    })
});

afterAll(async () => {
  await db.disconnect();
});

export let testDb: PrismaClient = db.client;
export let cleanDatabase = db.clean;
