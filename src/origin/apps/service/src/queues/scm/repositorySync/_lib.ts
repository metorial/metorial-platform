import { db } from '../../../db';
import { getScmProviderErrorDetails } from '../../../lib/scmProviderError';

export type RepositorySyncLogEntry = [number, string];

export let logRepositorySyncQueueEvent = (
  stage: string,
  message: string,
  d: Record<string, unknown>
) => {
  console.log(
    JSON.stringify({
      event: 'repository_sync_queue',
      level: 'info',
      stage,
      message,
      ...d
    })
  );
};

export let logRepositorySyncQueueError = (
  stage: string,
  message: string,
  error: unknown,
  d: Record<string, unknown>
) => {
  console.error(
    JSON.stringify({
      event: 'repository_sync_queue',
      level: 'error',
      stage,
      message,
      ...d,
      providerError: getScmProviderErrorDetails(error)
    })
  );
};

export let appendRepositorySyncLog = async (syncId: string, message: string) => {
  await db.scmRepositorySync.updateMany({
    where: { id: syncId },
    data: {
      logs: {
        push: [Date.now(), message] satisfies RepositorySyncLogEntry
      }
    }
  });
};

export let markRepositorySyncFailed = async (syncId: string, error: unknown) => {
  let message = error instanceof Error ? error.message : String(error);

  await db.scmRepositorySync.updateMany({
    where: {
      id: syncId,
      status: {
        notIn: ['merged', 'failed', 'cancelled', 'complete_unmerged', 'complete_no_changes']
      }
    },
    data: {
      status: 'failed',
      errorMessage: message,
      completedAt: new Date(),
      attemptCount: { increment: 1 },
      logs: {
        push: [Date.now(), 'Repository update failed.'] satisfies RepositorySyncLogEntry
      }
    }
  });
};
