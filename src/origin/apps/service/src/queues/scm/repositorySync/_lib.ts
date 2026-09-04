import { db } from '../../../db';
import {
  getScmProviderErrorDetails,
  getScmProviderLogDetails,
  isRetryableScmProviderError,
  toPublicProviderErrorMessage
} from '../../../lib/scmProviderError';
import {
  isTerminalRepositorySyncStatus,
  transitionRepositorySyncState
} from '../../../services/repositorySyncState';

export type RepositorySyncLogEntry = [number, string];

export let shouldRetryRepositorySyncContents = (d: {
  repositoryAccessMode: string;
  status: string;
  attemptCount: number;
  error: unknown;
}) => {
  if (d.status !== 'syncing_contents' || d.attemptCount >= 3) {
    return false;
  }

  let classification = getScmProviderErrorDetails(d.error).classification;
  return (
    (d.repositoryAccessMode === 'default_branch' && classification === 'conflict') ||
    isRetryableScmProviderError(d.error)
  );
};

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

let toPublicErrorMessage = (message: string) =>
  toPublicProviderErrorMessage(stripLowerdeckErrorPrefix(message));

export let getRepositorySyncErrorMessage = (error: unknown) => {
  let dataMessage = (error as any)?.data?.message;
  if (typeof dataMessage === 'string' && dataMessage.trim()) {
    return toPublicErrorMessage(dataMessage);
  }

  let message = error instanceof Error ? error.message : String(error);
  let serialized = message.match(/\s+\((\{.*\})\)\s*$/s)?.[1];
  if (serialized) {
    try {
      let parsed = JSON.parse(serialized);
      if (typeof parsed?.message === 'string' && parsed.message.trim()) {
        return toPublicErrorMessage(parsed.message);
      }
    } catch {
      // Keep the original message when the suffix is not lowerdeck error metadata.
    }
  }

  return toPublicErrorMessage(message.replace(/\s+\(\{.*\}\)\s*$/s, ''));
};

export let markRepositorySyncFailed = async (syncId: string, error: unknown) => {
  let sync = await db.scmRepositorySync.findUnique({ where: { id: syncId } });
  if (!sync || isTerminalRepositorySyncStatus(sync.status)) return;
  let details = getScmProviderErrorDetails(error);
  let message =
    sync.repositoryAccessMode === 'default_branch'
      ? details.classification === 'protected_branch'
        ? 'Direct push was blocked by repository rules. Use pull requests or allow writes to the default branch.'
        : ['permission_denied', 'authentication_failed'].includes(details.classification)
          ? 'The connected account cannot push to the default branch. Update repository access and retry.'
          : details.classification === 'conflict'
            ? 'The default branch changed while syncing. Retry the sync.'
            : ['rate_limited', 'timeout', 'upstream_failure', 'network_failure'].includes(
                  details.classification
                )
              ? 'The repository provider could not complete the update. Retry the sync.'
              : getRepositorySyncErrorMessage(error)
      : getRepositorySyncErrorMessage(error);
  await transitionRepositorySyncState(syncId, sync.status, {
    status: 'failed',
    errorMessage: message,
    completedAt: new Date(),
    attemptCount: { increment: 1 },
    nextPollAt: null,
    logs: {
      push: [Date.now(), 'Repository update failed.'] satisfies RepositorySyncLogEntry
    }
  });
};
