export type SyncOwnershipBoundaryResult<T> =
  | { type: 'completed'; value: T }
  | { type: 'expired' };

export type SyncCandidateResult<Response> =
  | { status: 'ignored' }
  | { status: 'abandoned' }
  | { status: 'error' }
  | { status: 'handled'; response?: Response };

export type SyncCandidatePlan<Response> =
  | { type: 'abandoned' }
  | { type: 'fallback' }
  | {
      type: 'checkpoint';
      checkpoint: 'skipped' | 'commit';
      continueRpc: boolean;
      response?: Response;
    };

export let planSyncCandidateResult = <Response>(
  result: SyncCandidateResult<Response>,
  options: { candidateIndex: number; candidateCount: number }
): SyncCandidatePlan<Response> => {
  if (result.status === 'abandoned') return { type: 'abandoned' };
  // Provider errors must remain eligible for the queued retry. In particular, do not persist a
  // completion checkpoint or add the failed trigger to the fallback exclusion list.
  if (result.status === 'error') return { type: 'fallback' };

  let response = result.status === 'handled' ? result.response : undefined;
  return {
    type: 'checkpoint',
    checkpoint: result.status === 'ignored' ? 'skipped' : 'commit',
    continueRpc: !response && options.candidateIndex < options.candidateCount - 1,
    response
  };
};

export let getSyncFallbackQueuePayload = (
  webhookRequestId: string,
  processedReceiverTriggerIds: string[]
) => ({
  webhookRequestId,
  excludeReceiverTriggerIds:
    processedReceiverTriggerIds.length > 0 ? [...processedReceiverTriggerIds] : undefined
});

export let runWithHardSyncOwnershipBoundary = <T>(
  work: (enterCommit: () => Promise<boolean>) => Promise<T>,
  options: {
    timeoutMs: number;
    enterCommit: () => Promise<boolean>;
    onLateError: (error: unknown) => void;
  }
) =>
  new Promise<SyncOwnershipBoundaryResult<T>>((resolve, reject) => {
    let phase: 'rpc' | 'enteringCommit' | 'commit' | 'expired' | 'failed' = 'rpc';
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    let settleExpired = () => {
      if (settled) return;
      settled = true;
      resolve({ type: 'expired' });
    };

    let enterCommit = async () => {
      if (phase !== 'rpc') return false;

      // While this conditional database update is in flight, the timeout cannot release the
      // distributed lock. A successful update proves that the owner entered commit before its
      // persisted RPC lease expired; a failed update fences the provider result.
      phase = 'enteringCommit';
      try {
        let entered = await options.enterCommit();
        if (!entered) {
          phase = 'expired';
          if (timer) clearTimeout(timer);
          settleExpired();
          return false;
        }

        phase = 'commit';
        if (timer) clearTimeout(timer);
        return true;
      } catch (error) {
        phase = 'failed';
        if (timer) clearTimeout(timer);
        throw error;
      }
    };

    let workPromise = work(enterCommit);
    timer = setTimeout(() => {
      if (phase !== 'rpc') return;
      phase = 'expired';
      settleExpired();
    }, options.timeoutMs);

    void workPromise.then(
      value => {
        if (settled) return;
        if (timer) clearTimeout(timer);
        settled = true;
        resolve({ type: 'completed', value });
      },
      error => {
        if (settled) {
          options.onLateError(error);
          return;
        }
        if (timer) clearTimeout(timer);
        settled = true;
        reject(error);
      }
    );
  });
