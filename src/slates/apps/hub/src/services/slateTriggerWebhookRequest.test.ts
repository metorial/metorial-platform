import { beforeEach, describe, expect, it, vi } from 'vitest';

let state = vi.hoisted(() => ({
  payloadFindFirst: vi.fn(),
  requestFindUnique: vi.fn(),
  requestFindFirst: vi.fn(),
  requestUpdateMany: vi.fn(),
  payloadUpdateMany: vi.fn(),
  queueAdd: vi.fn()
}));

vi.mock('../db', () => {
  let db: any = {
    slateTriggerWebhookRequestPayload: {
      findFirst: state.payloadFindFirst,
      updateMany: state.payloadUpdateMany
    },
    slateTriggerWebhookRequest: {
      findUnique: state.requestFindUnique,
      findFirst: state.requestFindFirst,
      updateMany: state.requestUpdateMany
    }
  };
  db.$transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(db));
  return { db };
});
vi.mock('../queues/trigger/webhook', () => ({
  slateTriggerWebhookQueue: { add: state.queueAdd }
}));

import { finalizeWebhookRequest } from './slateTriggerWebhookProcessing';
import { slateTriggerWebhookRequestService } from './slateTriggerWebhookRequest';

describe('webhook payload ownership and terminal finalizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.payloadFindFirst.mockResolvedValue({ oid: 1n });
    state.requestFindUnique.mockReset();
    state.requestFindUnique.mockResolvedValue({
      oid: 1n,
      tenantId: 'tenant-1',
      receiverOwnerId: 'receiver-1',
      authenticatedBoundaryKind: 'receiver_route',
      authenticatedBoundaryAt: new Date('2026-08-14T12:00:00.000Z'),
      authenticatedBindingHash: 'c'.repeat(64)
    });
    state.requestFindFirst.mockImplementation(async () =>
      state.requestUpdateMany.mock.calls.length === 0
        ? { authenticatedBoundaryKind: 'receiver_route' }
        : null
    );
    state.requestUpdateMany.mockResolvedValue({ count: 1 });
    state.payloadUpdateMany.mockResolvedValue({ count: 1 });
    state.queueAdd.mockResolvedValue({});
  });

  it('keeps inline ownership through enqueue and then confirms queue ownership', async () => {
    await expect(
      slateTriggerWebhookRequestService.prepareQueueTakeover({
        webhookRequestId: 'request-1',
        ownerToken: 'owner-1',
        claimToken: 'claim-1'
      })
    ).resolves.toBe(true);
    expect(state.payloadFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ consumedAt: null }) })
    );
    expect(state.requestUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ syncOwnerToken: 'owner-1' }),
        data: expect.objectContaining({ queueClaimState: 'prepared' })
      })
    );
    expect(state.requestUpdateMany.mock.calls[0]![0].data.syncOwnerToken).toBeUndefined();
    await slateTriggerWebhookRequestService.enqueueWebhookRequest({
      webhookRequestId: 'request-1',
      claimToken: 'claim-1'
    });
    await expect(
      slateTriggerWebhookRequestService.confirmQueueTakeover({
        webhookRequestId: 'request-1',
        ownerToken: 'owner-1',
        claimToken: 'claim-1'
      })
    ).resolves.toBe(true);
    expect(state.queueAdd).toHaveBeenCalledOnce();
    expect(state.requestUpdateMany.mock.calls[1]![0].data).toEqual(
      expect.objectContaining({ syncOwnerToken: null, queueClaimState: 'owned' })
    );
  });

  it('does not prepare takeover when encrypted payload ownership is missing', async () => {
    state.payloadFindFirst.mockResolvedValueOnce(null);
    await expect(
      slateTriggerWebhookRequestService.prepareQueueTakeover({
        webhookRequestId: 'request-1',
        ownerToken: 'owner-1',
        claimToken: 'claim-1'
      })
    ).resolves.toBe(false);
    expect(state.queueAdd).not.toHaveBeenCalled();
  });

  it('does not transfer ownership when enqueue fails', async () => {
    state.queueAdd.mockRejectedValueOnce(new Error('redis unavailable'));
    await slateTriggerWebhookRequestService.prepareQueueTakeover({
      webhookRequestId: 'request-1',
      ownerToken: 'owner-1',
      claimToken: 'claim-1'
    });
    await expect(
      slateTriggerWebhookRequestService.enqueueWebhookRequest({
        webhookRequestId: 'request-1',
        claimToken: 'claim-1'
      })
    ).rejects.toThrow('redis unavailable');
    expect(state.requestUpdateMany).toHaveBeenCalledTimes(1);
  });

  it('leaves the prepared inline owner recoverable when enqueue succeeds but confirm CAS loses', async () => {
    await slateTriggerWebhookRequestService.prepareQueueTakeover({
      webhookRequestId: 'request-1',
      ownerToken: 'owner-1',
      claimToken: 'claim-1'
    });
    await slateTriggerWebhookRequestService.enqueueWebhookRequest({
      webhookRequestId: 'request-1',
      claimToken: 'claim-1'
    });
    state.requestUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      slateTriggerWebhookRequestService.confirmQueueTakeover({
        webhookRequestId: 'request-1',
        ownerToken: 'owner-1',
        claimToken: 'claim-1'
      })
    ).resolves.toBe(false);
    expect(state.queueAdd).toHaveBeenCalledOnce();
    expect(state.requestUpdateMany.mock.calls[0]![0].data).not.toHaveProperty(
      'syncOwnerToken'
    );
  });

  it('uses one deterministic job id for duplicate delayed takeover publication', async () => {
    let input = {
      webhookRequestId: 'request-1',
      claimToken: 'claim-1',
      delayMs: 30_000,
      jobId: 'sync-fallback-request-1'
    };
    await slateTriggerWebhookRequestService.enqueueWebhookRequest(input);
    await slateTriggerWebhookRequestService.enqueueWebhookRequest(input);
    expect(state.queueAdd).toHaveBeenCalledTimes(2);
    expect(state.queueAdd.mock.calls.map(call => call[1])).toEqual([
      { delay: 30_000, id: 'sync-fallback-request-1' },
      { delay: 30_000, id: 'sync-fallback-request-1' }
    ]);
  });

  it('does not decrypt a payload after terminal consumption', async () => {
    state.requestFindUnique.mockResolvedValueOnce({
      id: 'request-1',
      tenantId: 'tenant-1',
      receiverOwnerId: 'receiver-1',
      payload: {
        tenantId: 'tenant-1',
        receiverId: 'receiver-1',
        consumedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000)
      }
    });

    await expect(
      slateTriggerWebhookRequestService.loadDecryptedPayload({
        webhookRequestId: 'request-1'
      })
    ).rejects.toThrow('already been consumed');
  });

  it.each(['accepted', 'failed'] as const)(
    'sanitizes the %s finalizer path and applies terminal retention',
    async outcome => {
      let now = new Date('2026-08-14T12:00:00.000Z');
      await expect(
        finalizeWebhookRequest({
          request: {
            id: 'request-1',
            receiverTriggerId: 'trigger-1',
            receiverId: null,
            url: 'https://hooks.test/slates-hub/triggers/webhook/id/path-secret?token=query-secret',
            method: 'POST',
            headers: {
              Authorization: 'header-secret',
              'Content-Type': 'application/json'
            },
            createdAt: now
          },
          body: {
            encoding: 'base64',
            content: Buffer.from('body-secret').toString('base64')
          },
          outcome,
          now
        })
      ).resolves.toBe(true);
      let update = state.requestUpdateMany.mock.calls[0]![0];
      expect(JSON.stringify(update.data)).not.toMatch(
        /query-secret|header-secret|body-secret/
      );
      expect(update.data.body).toBeNull();
      expect(update.data.bodyStorageKey).toBeNull();
      expect(state.payloadUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ consumedAt: now, expiresAt: expect.any(Date) })
        })
      );
    }
  );

  it('terminal queue failure is claim-bound and idempotent', async () => {
    let now = new Date('2026-08-14T12:00:00.000Z');
    state.requestUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    let input = {
      request: {
        id: 'request-1',
        receiverTriggerId: 'trigger-1',
        receiverId: null,
        url: 'https://hooks.test/[REDACTED]',
        method: 'POST',
        headers: [],
        createdAt: now
      },
      body: null,
      queueClaimToken: 'claim-1',
      outcome: 'failed' as const,
      safeRejectionCode: 'webhook_processing_failed',
      now
    };
    await expect(finalizeWebhookRequest(input)).resolves.toBe(true);
    await expect(finalizeWebhookRequest(input)).resolves.toBe(false);
    expect(state.requestUpdateMany.mock.calls[0]![0].where).toEqual(
      expect.objectContaining({ queueClaimToken: 'claim-1', queueClaimState: 'owned' })
    );
    expect(state.payloadUpdateMany).toHaveBeenCalledTimes(1);
    expect(state.payloadUpdateMany.mock.calls[0]![0].data).toEqual(
      expect.objectContaining({ terminalOutcome: 'failed' })
    );
  });
});
