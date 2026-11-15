import { addAfterTransactionHook } from '@metorial/db';

export let recordAuditEventAfterCommit = async (
  record: (recordedAt: Date) => Promise<void>
) => {
  let recordedAt = new Date();

  await addAfterTransactionHook(async () => {
    try {
      await record(recordedAt);
    } catch (error) {
      console.error('[Audit] Failed to record audit event after transaction', error);
    }
  });
};
