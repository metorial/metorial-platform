import { db } from '../../../db';
import { getScmProviderLogDetails } from '../../../lib/scmProviderError';
import {
  isTerminalRepositorySyncStatus,
  transitionRepositorySyncState
} from '../../../services/repositorySyncState';

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
      providerDiagnostic: getScmProviderLogDetails(error)
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

let stripLowerdeckErrorPrefix = (message: string) =>
  message.replace(/^\[@lowerdeck\/error\]:\s*/, '').trim();

export let getRepositorySyncErrorMessage = (error: unknown) => {
  let dataMessage = (error as any)?.data?.message;
  if (typeof dataMessage === 'string' && dataMessage.trim()) {
    return stripLowerdeckErrorPrefix(dataMessage);
  }

  let message = error instanceof Error ? error.message : String(error);
  let serialized = message.match(/\s+\((\{.*\})\)\s*$/s)?.[1];
  if (serialized) {
    try {
      let parsed = JSON.parse(serialized);
      if (typeof parsed?.message === 'string' && parsed.message.trim()) {
        return stripLowerdeckErrorPrefix(parsed.message);
      }
    } catch {
      // Keep the original message when the suffix is not lowerdeck error metadata.
    }
  }

  return stripLowerdeckErrorPrefix(message.replace(/\s+\(\{.*\}\)\s*$/s, ''));
};

export let markRepositorySyncFailed = async (syncId: string, error: unknown) => {
  let message = getRepositorySyncErrorMessage(error);

  let sync = await db.scmRepositorySync.findUnique({ where: { id: syncId } });
  if (!sync || isTerminalRepositorySyncStatus(sync.status)) return;
  await transitionRepositorySyncState(syncId, sync.status, {
    status: 'failed',
    errorMessage: message,
    completedAt: new Date(),
    attemptCount: { increment: 1 },
    logs: {
      push: [Date.now(), 'Repository update failed.'] satisfies RepositorySyncLogEntry
    }
  });
};
