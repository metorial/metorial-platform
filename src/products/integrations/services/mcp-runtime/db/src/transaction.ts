import type { db } from './db';

export { addAfterTransactionHook, withTransaction } from './db';

export type TransactionDB = Parameters<Parameters<typeof db.$transaction>[0]>[0];
