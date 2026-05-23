import { setupPrismaTestDb, setupTestGlobals } from '@mtsrc/testing-tools';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll } from 'vitest';
import { PrismaClient } from '../../prisma/generated/client';
import { provider as awsLambdaProvider } from '../providers/aws-lambda/provider';
import { provider as localProvider } from '../providers/local/provider';

setupTestGlobals({ nodeEnv: 'test' });

const db = await setupPrismaTestDb<PrismaClient>({
  guard: 'function-bay-test',
  prismaClientFactory: url =>
    new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
});

afterAll(async () => {
  await db.disconnect();
});

export const testDb: PrismaClient = db.client;

// Clean database and re-seed the provider with the same oid that production code expects
export const cleanDatabase = async () => {
  await db.clean();
  for (let provider of [awsLambdaProvider, localProvider]) {
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
  }
};
