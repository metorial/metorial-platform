import { setupPrismaTestDb } from '@lowerdeck/testing-tools';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll } from 'vitest';
import { PrismaClient } from '../../prisma/generated/client';

let testDatabase = await setupPrismaTestDb<PrismaClient>({
  guard: 'groundstation-test',
  prismaClientFactory: url =>
    new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
});

afterAll(async () => {
  await testDatabase.disconnect();
});

export let testDb: PrismaClient = testDatabase.client;
export let cleanDatabase = testDatabase.clean;
