import { createDatabase } from '@lowerdeck/prisma-pg';
import { PrismaClient } from '../prisma/generated/client';

export let { db } = createDatabase({
  name: 'secret-store',
  url: ['NEBULA_DATABASE_URL', 'DATABASE_URL'],
  createClient: adapter =>
    new PrismaClient({
      adapter,
      transactionOptions: {
        maxWait: 10000,
        timeout: 12000
      }
    })
});
