import { describe, expect, it, vi } from 'vitest';
import {
  processSlateTriggerWebhookQueueRequest,
  settleExactWebhookQueueResult,
  type PendingWebhookQueueRequest
} from './triggerWebhookQueueProcessing';

let request = (
  overrides?: Partial<PendingWebhookQueueRequest>
): PendingWebhookQueueRequest => ({
  id: 'wr_test',
  receiverTriggerId: null,
  receiverId: 'receiver_test',
  syncOwnerToken: null,
  syncOwnerExpiresAt: null,
  syncOwnerCommitStartedAt: null,
  syncCompletedReceiverTriggerIds: [],
  queueClaimToken: 'claim',
  queueClaimState: 'owned',
  ...overrides
});

describe('processSlateTriggerWebhookQueueRequest', () => {
  it.each([
    ['success', { status: 'committed' }, 'accepted'],
    ['rejection', { status: 'rejected', code: 'credential_invalid' }, 'rejected']
  ] as const)(
    'routes %s verification to the transaction-owning terminal handler',
    async (_name, result, expected) => {
      let calls: string[] = [];
      await expect(
        settleExactWebhookQueueResult({
          result: result as any,
          onAccepted: async () => {
            calls.push('accepted');
          },
          onRejected: async () => {
            calls.push('rejected');
          }
        })
      ).resolves.toBe(expected);
      expect(calls).toEqual([expected]);
    }
  );

  it('re-checks processed state after held ownership releases and skips late-success work', async () => {
    let pendingRequest: PendingWebhookQueueRequest | null = request({
      syncOwnerToken: 'committing-owner',
      syncOwnerExpiresAt: new Date('2026-01-01T00:00:02.000Z'),
      syncOwnerCommitStartedAt: new Date('2026-01-01T00:00:00.500Z')
    });
    let releaseLock!: () => void;
    let lockEntered!: () => void;
    let entered = new Promise<void>(resolve => {
      lockEntered = resolve;
    });
    let released = new Promise<void>(resolve => {
      releaseLock = resolve;
    });
    let handleTarget = vi.fn();
    let finalize = vi.fn();

    let processing = processSlateTriggerWebhookQueueRequest(
      { webhookRequestId: 'wr_test', claimToken: 'claim' },
      {
        loadPendingRequest: async () => pendingRequest,
        usingLock: async (_key, callback) => {
          lockEntered();
          await released;
          return callback();
        },
        claimQueueOwnership: async () => 'owned',
        targetExists: async () => true,
        handleTarget,
        checkpointTriggerCompleted: vi.fn(),
        finalize
      }
    );

    await entered;
    pendingRequest = null;
    releaseLock();

    await expect(processing).resolves.toBe('skipped');
    expect(handleTarget).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
  });

  it('takes over expired non-settling ownership and excludes persisted completions', async () => {
    let pendingRequest: PendingWebhookQueueRequest | null = request({
      syncOwnerToken: 'expired-owner',
      syncOwnerExpiresAt: new Date('2026-01-01T00:00:00.000Z'),
      syncCompletedReceiverTriggerIds: ['trigger_done']
    });
    let calls: string[] = [];
    let handleTarget = vi.fn(async (_request, excluded: string[]) => {
      calls.push('handle');
      expect(excluded).toEqual(['payload_done', 'trigger_done']);
    });

    await expect(
      processSlateTriggerWebhookQueueRequest(
        {
          webhookRequestId: 'wr_test',
          claimToken: 'claim',
          excludeReceiverTriggerIds: ['payload_done']
        },
        {
          loadPendingRequest: async () => pendingRequest,
          usingLock: async (_key, callback) => callback(),
          claimQueueOwnership: async value => {
            calls.push('fence');
            value.syncOwnerToken = null;
            value.syncOwnerExpiresAt = null;
            return 'owned';
          },
          targetExists: async () => true,
          handleTarget,
          checkpointTriggerCompleted: vi.fn(),
          finalize: async () => {
            calls.push('finalize');
            pendingRequest = null;
          },
          now: () => new Date('2026-01-01T00:00:01.000Z')
        }
      )
    ).resolves.toBe('processed');

    expect(calls).toEqual(['fence', 'handle', 'finalize']);
    expect(handleTarget).toHaveBeenCalledTimes(1);
    expect(pendingRequest).toBeNull();
  });

  it('retries instead of overlapping a still-active owner', async () => {
    let handleTarget = vi.fn();
    let finalize = vi.fn();

    await expect(
      processSlateTriggerWebhookQueueRequest(
        { webhookRequestId: 'wr_test', claimToken: 'claim' },
        {
          loadPendingRequest: async () =>
            request({
              syncOwnerToken: 'active-owner',
              syncOwnerExpiresAt: new Date('2026-01-01T00:00:02.000Z')
            }),
          usingLock: async (_key, callback) => callback(),
          claimQueueOwnership: async () => 'ownerActive',
          targetExists: async () => true,
          handleTarget,
          checkpointTriggerCompleted: vi.fn(),
          finalize,
          now: () => new Date('2026-01-01T00:00:01.000Z')
        }
      )
    ).resolves.toBe('ownerActive');

    expect(handleTarget).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
  });

  it('skips duplicate or swapped queue claims without handling or finalizing', async () => {
    let handleTarget = vi.fn();
    let finalize = vi.fn();
    await expect(
      processSlateTriggerWebhookQueueRequest(
        { webhookRequestId: 'wr_test', claimToken: 'swapped-claim' },
        {
          loadPendingRequest: async () =>
            request({ queueClaimToken: 'claim', queueClaimState: 'owned' }),
          usingLock: async (_key, callback) => callback(),
          claimQueueOwnership: async (_request, token) =>
            token === 'claim' ? 'owned' : 'invalid',
          targetExists: async () => true,
          handleTarget,
          checkpointTriggerCompleted: vi.fn(),
          finalize
        }
      )
    ).resolves.toBe('skipped');
    expect(handleTarget).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
  });

  it('checkpoints partial receiver fanout and merges it into retry exclusions', async () => {
    let pendingRequest: PendingWebhookQueueRequest | null = request();
    let attempts = 0;
    let handled: string[] = [];
    let finalize = vi.fn(async () => {
      pendingRequest = null;
    });
    let dependencies = {
      loadPendingRequest: async () => pendingRequest,
      usingLock: async <T>(_key: string, callback: () => Promise<T>) => callback(),
      claimQueueOwnership: async () => 'owned' as const,
      targetExists: async () => true,
      handleTarget: async (
        _request: PendingWebhookQueueRequest,
        excluded: string[],
        checkpoint: (receiverTriggerId: string) => Promise<void>
      ) => {
        attempts += 1;
        for (let receiverTriggerId of ['trigger_first', 'trigger_second']) {
          if (excluded.includes(receiverTriggerId)) continue;
          handled.push(receiverTriggerId);
          if (attempts === 1 && receiverTriggerId === 'trigger_second') {
            throw new Error('second trigger failed');
          }
          await checkpoint(receiverTriggerId);
        }
      },
      checkpointTriggerCompleted: async (
        value: PendingWebhookQueueRequest,
        receiverTriggerId: string
      ) => {
        value.syncCompletedReceiverTriggerIds.push(receiverTriggerId);
      },
      finalize
    };

    await expect(
      processSlateTriggerWebhookQueueRequest(
        {
          webhookRequestId: 'wr_test',
          claimToken: 'claim',
          excludeReceiverTriggerIds: ['payload_done']
        },
        dependencies
      )
    ).rejects.toThrow('second trigger failed');
    expect(pendingRequest?.syncCompletedReceiverTriggerIds).toEqual(['trigger_first']);
    expect(finalize).not.toHaveBeenCalled();

    await expect(
      processSlateTriggerWebhookQueueRequest(
        {
          webhookRequestId: 'wr_test',
          claimToken: 'claim',
          excludeReceiverTriggerIds: ['payload_done']
        },
        dependencies
      )
    ).resolves.toBe('processed');

    expect(handled).toEqual(['trigger_first', 'trigger_second', 'trigger_second']);
    expect(finalize).toHaveBeenCalledTimes(1);
  });
});
