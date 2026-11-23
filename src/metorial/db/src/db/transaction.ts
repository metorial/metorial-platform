import type { db } from './client';

export {
  addAfterTransactionHook,
  addAwaitedAfterTransactionHook,
  isInTransaction,
  withTransaction
} from './client';

export type TransactionDB = Parameters<Parameters<typeof db.$transaction>[0]>[0];
