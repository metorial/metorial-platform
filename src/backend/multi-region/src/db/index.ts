import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/client.js';
export * from '../../prisma/generated/client.js';

let createClient = () => {
  let mainAdapter = new PrismaPg({
    connectionString: process.env.GLOBAL_DATABASE_URL
  });

  let baseClient = new PrismaClient({
    adapter: mainAdapter,
    transactionOptions: {
      maxWait: 10000,
      timeout: 12000
    }
  });

  return baseClient;
};

let globalDB: PrismaClient = createClient();

export { globalDB };

export type GlobalDB = typeof globalDB;

declare global {
  namespace PrismaJson {}
}
