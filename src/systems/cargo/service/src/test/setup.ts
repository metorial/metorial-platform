process.env.CARGO_API_PORT ??= '52150';
process.env.CARGO_CONTENT_PORT ??= '52151';
process.env.CARGO_HEALTH_PORT ??= '12121';
process.env.REDIS_URL ??= 'redis://localhost:56379/0';
process.env.VOYAGER_URL ??= 'http://voyager.test/metorial-voyager';
process.env.OBJECT_STORAGE_URL ??= 'http://object-storage.test';
process.env.FILES_BUCKET_NAME ??= 'cargo-files-test';
process.env.DOWNLOAD_PUBLIC_URL ??= 'http://cargo-content.test';
process.env.API_URL ??= 'http://cargo-api.test';
process.env.CARGO_REGION ??= 'tst';
process.env.SIGNED_DOWNLOAD_URL_TOKEN_SECRET ??= 'cargo-download-test-secret';

import { PrismaPg } from '@prisma/adapter-pg';
import { flushAfterTransactionHooks, PrismaClient } from '@metorial-cargo/db';
import { afterAll } from 'vitest';
import { setupPrismaTestDb, setupTestGlobals } from '@lowerdeck/testing-tools';
import { resetVoyagerStub, setupVoyagerStub } from './helpers/voyagerStub';

setupTestGlobals({ nodeEnv: 'test' });
setupVoyagerStub();

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

let wait = async (ms: number) => await new Promise(resolve => setTimeout(resolve, ms));

let isTransientCleanupError = (error: any) => {
  let codes = [error?.code, error?.meta?.code, error?.cause?.code];
  if (codes.some(code => code === '40P01' || code === '40001')) return true;

  let message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('40P01') ||
    message.includes('40001') ||
    message.includes('deadlock detected') ||
    message.includes('could not serialize access')
  );
};

export let cleanDatabase = async () => {
  await flushAfterTransactionHooks();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await db.clean();
      resetVoyagerStub();
      await flushAfterTransactionHooks();
      return;
    } catch (error) {
      if (attempt === 2 || !isTransientCleanupError(error)) throw error;

      await flushAfterTransactionHooks();
      await wait(50 * (attempt + 1));
    }
  }
};
