import type { db } from './db';

export { addAfterTransactionHook, isInTransaction, withTransaction } from './db';

export type TransactionDB = Parameters<Parameters<typeof db.$transaction>[0]>[0];
