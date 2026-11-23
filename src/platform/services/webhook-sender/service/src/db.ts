import { createDatabase } from '@lowerdeck/prisma-pg';
import { PrismaClient } from '../prisma/generated/client';

export let { db } = createDatabase({
  name: 'webhook-sender',
  url: ['SIGNAL_DATABASE_URL', 'DATABASE_URL'],
  createClient: adapter =>
    new PrismaClient({
      adapter,
      transactionOptions: {
        maxWait: 10000,
        timeout: 12000
      }
    })
});

declare global {
  namespace PrismaJson {
    type Headers = [string, string][];
  }
}
