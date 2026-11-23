import { withTransaction, type TransactionDB } from '@metorial/db';

// A transaction always runs on the primary, so a read through it never sees a lagging
// replica.
export let readFromPrimary = <T>(read: (db: TransactionDB) => Promise<T>) =>
  withTransaction(read);
