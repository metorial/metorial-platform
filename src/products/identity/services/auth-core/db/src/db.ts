import { createDatabase } from '@lowerdeck/prisma-pg';
import { PrismaClient } from '../prisma/generated/client';

export let { db, withTransaction, addAfterTransactionHook } = createDatabase({
  name: 'auth-core',
  url: 'DATABASE_URL',
  createClient: adapter => new PrismaClient({ adapter }),
  afterHookDelayMs: 5000,
  warnOnAfterHookOutsideTransaction: true
});

declare global {
  namespace PrismaJson {
    // @ts-ignore
    type EntityImage =
      | { type: 'file'; url?: string; fileUrl?: string }
      | { type: 'url'; url: string }
      | { type: 'icon'; icon: string; color: string }
      | { type: 'default' };
  }
}

export type TransactionDB = Parameters<Parameters<typeof db.$transaction>[0]>[0];
