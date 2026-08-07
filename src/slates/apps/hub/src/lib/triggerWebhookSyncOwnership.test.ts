import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSyncFallbackQueuePayload,
  planSyncCandidateResult,
  runWithHardSyncOwnershipBoundary
} from './triggerWebhookSyncOwnership';

let deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  let promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('runWithHardSyncOwnershipBoundary', () => {
  it('fences a provider result that arrives after the RPC ownership phase expires', async () => {
    vi.useFakeTimers();
    let provider = deferred<string>();
    let enterPersistedCommit = vi.fn(async () => true);
    let appliedSideEffect = false;

    let processing = runWithHardSyncOwnershipBoundary(
      async enterCommit => {
        await provider.promise;
        if (!(await enterCommit())) return 'abandoned';
        appliedSideEffect = true;
        return 'handled';
      },
      {
        timeoutMs: 10,
        enterCommit: enterPersistedCommit,
        onLateError: vi.fn()
      }
    );

    await vi.advanceTimersByTimeAsync(10);
    await expect(processing).resolves.toEqual({ type: 'expired' });

    provider.resolve('late');
    await vi.runAllTimersAsync();
    await Promise.resolve();

    expect(enterPersistedCommit).not.toHaveBeenCalled();
    expect(appliedSideEffect).toBe(false);
  });

  it('disables hard takeover while an admitted commit is still applying side effects', async () => {
    vi.useFakeTimers();
    let commitAdmission = deferred<boolean>();
    let finishSideEffects = deferred<void>();
    let settled = false;

    let processing = runWithHardSyncOwnershipBoundary(
      async enterCommit => {
        if (!(await enterCommit())) return 'abandoned';
        await finishSideEffects.promise;
        return 'handled';
      },
      {
        timeoutMs: 10,
        enterCommit: () => commitAdmission.promise,
        onLateError: vi.fn()
      }
    );
    void processing.finally(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(10);
    expect(settled).toBe(false);

    commitAdmission.resolve(true);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(settled).toBe(false);

    finishSideEffects.resolve();
    await expect(processing).resolves.toEqual({ type: 'completed', value: 'handled' });
  });

  it('expires without side effects when atomic commit admission rejects the owner', async () => {
    vi.useFakeTimers();
    let appliedSideEffect = false;

    let processing = runWithHardSyncOwnershipBoundary(
      async enterCommit => {
        if (!(await enterCommit())) return 'abandoned';
        appliedSideEffect = true;
        return 'handled';
      },
      {
        timeoutMs: 10,
        enterCommit: async () => false,
        onLateError: vi.fn()
      }
    );

    await expect(processing).resolves.toEqual({ type: 'expired' });
    expect(appliedSideEffect).toBe(false);
  });
});

describe('planSyncCandidateResult', () => {
  it('retries a failed later candidate while preserving only earlier completion exclusions', () => {
    let processedReceiverTriggerIds: string[] = [];
    let checkpoints: string[] = [];

    let first = planSyncCandidateResult(
      { status: 'handled' },
      { candidateIndex: 0, candidateCount: 2 }
    );
    expect(first).toMatchObject({
      type: 'checkpoint',
      checkpoint: 'commit',
      continueRpc: true
    });
    if (first.type === 'checkpoint') {
      checkpoints.push('trigger_first');
      processedReceiverTriggerIds.push('trigger_first');
    }

    let second = planSyncCandidateResult(
      { status: 'error' },
      { candidateIndex: 1, candidateCount: 2 }
    );
    expect(second).toEqual({ type: 'fallback' });

    let fallbackPayload = getSyncFallbackQueuePayload(
      'request_test',
      processedReceiverTriggerIds
    );
    expect(checkpoints).toEqual(['trigger_first']);
    expect(fallbackPayload).toEqual({
      webhookRequestId: 'request_test',
      excludeReceiverTriggerIds: ['trigger_first']
    });
    expect(fallbackPayload.excludeReceiverTriggerIds).not.toContain('trigger_second');
  });
});
