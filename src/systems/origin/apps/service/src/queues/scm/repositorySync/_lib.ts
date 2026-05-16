import { db } from '../../../db';

export let markRepositorySyncFailed = async (syncId: string, error: unknown) => {
  let message = error instanceof Error ? error.message : String(error);

  await db.scmRepositorySync.updateMany({
    where: {
      id: syncId,
      status: {
        notIn: ['merged', 'failed', 'cancelled', 'complete_unmerged']
      }
    },
    data: {
      status: 'failed',
      errorMessage: message,
      completedAt: new Date(),
      attemptCount: { increment: 1 }
    }
  });
};
