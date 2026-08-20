import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db', () => ({ db: {} }));
vi.mock('../../services/slateTriggerWebhookProcessing', () => ({
  finalizeWebhookRequest: vi.fn()
}));
vi.mock('./eventQueues', () => ({
  slateTriggerWebhookTerminalRepairQueue: {
    add: vi.fn(),
    process: vi.fn(() => ({ start: vi.fn() }))
  }
}));
vi.mock('@lowerdeck/cron', () => ({
  createCron: vi.fn(() => ({ start: vi.fn() }))
}));

import {
  classifyWebhookTerminalState,
  handleExhaustedWebhookFailure,
  runWebhookTerminalRepair
} from './webhookTerminalRepair';

let makeStore = (requestState: any = {}) => {
  let request = {
    id: 'request-1',
    receiverTriggerId: 'trigger-1',
    receiverId: null,
    url: 'https://hooks.test/[REDACTED]',
    method: 'POST',
    headers: [],
    createdAt: new Date(),
    processedAt: null,
    queueClaimToken: 'claim-1',
    queueClaimState: 'owned',
    ...requestState
  };
  let repair: any = null;
  let store: any = {
    slateTriggerWebhookRequest: {
      findUnique: vi.fn(async () => request),
      updateMany: vi.fn(async ({ data }: any) => {
        if (
          request.processedAt ||
          request.queueClaimToken !== 'claim-1' ||
          request.queueClaimState !== 'prepared'
        ) {
          return { count: 0 };
        }
        Object.assign(request, data);
        return { count: 1 };
      })
    },
    webhookTerminalFinalizationRepair: {
      upsert: vi.fn(async ({ create, update }: any) => {
        repair = repair ? { ...repair, ...update } : { ...create };
        return repair;
      }),
      update: vi.fn(async ({ data }: any) => {
        repair = { ...repair, ...data };
        return repair;
      }),
      findUnique: vi.fn(async () => repair)
    }
  };
  return { store, request, getRepair: () => repair };
};

describe('durable webhook terminal finalization repair', () => {
  it('persists and enqueues a repair when the exhausted finalizer throws', async () => {
    let { store, getRepair } = makeStore();
    let enqueue = vi.fn(async () => {});
    await expect(
      handleExhaustedWebhookFailure({
        store,
        requestId: 'request-1',
        claimToken: 'claim-1',
        safeRejectionCode: 'webhook_processing_failed',
        finalize: async () => {
          throw new Error('database unavailable');
        },
        enqueue
      })
    ).resolves.toBe('repair_durable');
    expect(getRepair()).toEqual(expect.objectContaining({ status: 'pending' }));
    expect(enqueue).toHaveBeenCalledWith(getRepair().id, {
      id: `webhook-terminal-repair-${getRepair().id}`
    });
  });

  it('keeps the durable row pending when repair queue publication fails', async () => {
    let { store, getRepair } = makeStore();
    await expect(
      handleExhaustedWebhookFailure({
        store,
        requestId: 'request-1',
        claimToken: 'claim-1',
        safeRejectionCode: 'webhook_processing_failed',
        finalize: async () => false,
        enqueue: async () => {
          throw new Error('redis unavailable');
        }
      })
    ).resolves.toBe('repair_durable');
    expect(getRepair()).toEqual(
      expect.objectContaining({
        status: 'pending',
        lastErrorCode: 'repair_queue_publish_failed'
      })
    );
  });

  it.each([
    [{ processedAt: new Date() }, 'already_terminal'],
    [{ queueClaimToken: 'other' }, 'stale_claim']
  ] as const)('classifies false finalizer state %s', async (state, expected) => {
    let { store, getRepair } = makeStore(state);
    let enqueue = vi.fn();
    await expect(
      handleExhaustedWebhookFailure({
        store,
        requestId: 'request-1',
        claimToken: 'claim-1',
        safeRejectionCode: 'webhook_processing_failed',
        finalize: async () => false,
        enqueue
      })
    ).resolves.toBe(expected);
    if (expected === 'already_terminal') {
      expect(getRepair()).toBeNull();
    } else {
      expect(getRepair()).toEqual(expect.objectContaining({ status: 'blocked' }));
    }
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('records a missing request without attempting unsafe ownership bypass', async () => {
    let { store, getRepair } = makeStore();
    store.slateTriggerWebhookRequest.findUnique.mockResolvedValue(null);
    expect(
      await classifyWebhookTerminalState({
        store,
        requestId: 'missing',
        claimToken: 'claim-1'
      })
    ).toBe('missing');
    await handleExhaustedWebhookFailure({
      store,
      requestId: 'missing',
      claimToken: 'claim-1',
      safeRejectionCode: 'webhook_processing_failed',
      finalize: async () => false,
      enqueue: vi.fn()
    });
    expect(getRepair()).toEqual(expect.objectContaining({ status: 'blocked' }));
  });

  it('takes over an expired prepared claim before terminal finalization', async () => {
    let { store, request, getRepair } = makeStore({
      queueClaimState: 'prepared',
      syncOwnerToken: 'expired-owner',
      syncOwnerExpiresAt: new Date('2026-01-01T00:00:00.000Z')
    });
    let finalize = vi.fn(async () => request.queueClaimState === 'owned');

    await expect(
      handleExhaustedWebhookFailure({
        store,
        requestId: 'request-1',
        claimToken: 'claim-1',
        safeRejectionCode: 'webhook_processing_failed',
        finalize,
        enqueue: vi.fn()
      })
    ).resolves.toBe('finalized');

    expect(store.slateTriggerWebhookRequest.updateMany).toHaveBeenCalledOnce();
    expect(request).toEqual(
      expect.objectContaining({
        queueClaimState: 'owned',
        syncOwnerToken: null,
        syncOwnerExpiresAt: null
      })
    );
    expect(getRepair()).toBeNull();
  });

  it('keeps an active inline owner in durable pending repair until takeover is safe', async () => {
    let { store, getRepair } = makeStore({
      queueClaimState: 'prepared',
      syncOwnerToken: 'active-owner',
      syncOwnerExpiresAt: new Date('2099-01-01T00:00:00.000Z')
    });
    let enqueue = vi.fn(async () => {});

    await expect(
      handleExhaustedWebhookFailure({
        store,
        requestId: 'request-1',
        claimToken: 'claim-1',
        safeRejectionCode: 'webhook_processing_failed',
        finalize: async () => false,
        enqueue
      })
    ).resolves.toBe('repair_durable');

    expect(getRepair()).toEqual(expect.objectContaining({ status: 'pending' }));
    expect(store.slateTriggerWebhookRequest.updateMany).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledOnce();
  });

  it('converges duplicate callbacks and an eventual repair to one terminal record', async () => {
    let { store, request, getRepair } = makeStore();
    let enqueue = vi.fn(async () => {});
    let input = {
      store,
      requestId: 'request-1',
      claimToken: 'claim-1',
      safeRejectionCode: 'webhook_processing_failed',
      finalize: async () => false,
      enqueue
    };
    await handleExhaustedWebhookFailure(input);
    await handleExhaustedWebhookFailure(input);
    expect(store.webhookTerminalFinalizationRepair.upsert).toHaveBeenCalledTimes(2);
    expect(enqueue.mock.calls[0]![1]).toEqual(enqueue.mock.calls[1]![1]);

    let finalized = vi.fn(async () => {
      request.processedAt = new Date();
      return true;
    });
    await expect(
      runWebhookTerminalRepair({ repairId: getRepair().id, store, finalize: finalized })
    ).resolves.toBe('finalized');
    expect(getRepair()).toEqual(
      expect.objectContaining({
        status: 'completed',
        completionEvidence: expect.objectContaining({
          type: 'terminal_finalization_committed'
        })
      })
    );
    expect(finalized).toHaveBeenCalledOnce();
  });
});
