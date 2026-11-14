import { addAfterTransactionHook } from '@metorial/db';

// Same shape as `audit-listeners`'s `recordAuditEventAfterCommit`, copied under its own name rather
// than imported — this package deliberately doesn't depend on `audit-listeners`, it just reuses the
// same Fabric hooks and the same after-commit pattern.
export let recordSystemEventAfterCommit = async (record: () => Promise<void>) => {
  await addAfterTransactionHook(async () => {
    try {
      await record();
    } catch (error) {
      console.error('[Webhooks] Failed to enqueue system event after transaction', error);
    }
  });
};
