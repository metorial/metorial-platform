import { beforeEach, describe, expect, it, vi } from 'vitest';

let triggerEventFindMany = vi.fn();
let triggerEventInvocationFindMany = vi.fn();
let slateWebhookEventInvocationFindMany = vi.fn();

vi.mock('../db', () => ({
  db: {
    triggerEvent: { findMany: triggerEventFindMany },
    triggerEventInvocation: { findMany: triggerEventInvocationFindMany },
    slateWebhookEventInvocation: { findMany: slateWebhookEventInvocationFindMany }
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));

let tenant = { oid: BigInt(1), id: 'ten_1' } as any;

let invocation = (id: string) => ({ oid: BigInt(900), id, isPending: false });

describe('triggerEventInvocationService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    triggerEventInvocationFindMany.mockResolvedValue([]);
    slateWebhookEventInvocationFindMany.mockResolvedValue([]);
  });

  it('short circuits without touching the database for an empty id list', async () => {
    let { triggerEventInvocationService } = await import('./triggerEventInvocation');

    let res =
      await triggerEventInvocationService.getManyTriggerEventInvocationsByTriggerEventIds({
        tenant,
        triggerEventIds: []
      });

    expect(res).toEqual([]);
    expect(triggerEventFindMany).not.toHaveBeenCalled();
  });

  it('scopes the trigger event lookup to the tenant', async () => {
    triggerEventFindMany.mockResolvedValue([]);

    let { triggerEventInvocationService } = await import('./triggerEventInvocation');

    await triggerEventInvocationService.getManyTriggerEventInvocationsByTriggerEventIds({
      tenant,
      triggerEventIds: ['sttrev_1']
    });

    expect(triggerEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['sttrev_1'] },
          triggerRegistrationInstance: { triggerRegistration: { tenantOid: BigInt(1) } }
        }
      })
    );
  });

  it('returns nothing when no trigger event is visible to the tenant', async () => {
    triggerEventFindMany.mockResolvedValue([]);

    let { triggerEventInvocationService } = await import('./triggerEventInvocation');

    let res =
      await triggerEventInvocationService.getManyTriggerEventInvocationsByTriggerEventIds({
        tenant,
        triggerEventIds: ['sttrev_1']
      });

    expect(res).toEqual([]);
    expect(triggerEventInvocationFindMany).not.toHaveBeenCalled();
    expect(slateWebhookEventInvocationFindMany).not.toHaveBeenCalled();
  });

  it('attributes mapping invocations to their own trigger event', async () => {
    triggerEventFindMany.mockResolvedValue([
      { oid: BigInt(10), id: 'sttrev_1', webhookEventOid: null }
    ]);
    triggerEventInvocationFindMany.mockResolvedValue([
      {
        id: 'sttrevi_1',
        status: 'succeeded',
        attempt: 1,
        errorCode: null,
        errorMessage: null,
        triggerEventOid: BigInt(10),
        invocation: invocation('inv_1'),
        createdAt: new Date('2026-01-01T00:00:00Z')
      }
    ]);

    let { triggerEventInvocationService } = await import('./triggerEventInvocation');

    let res =
      await triggerEventInvocationService.getManyTriggerEventInvocationsByTriggerEventIds({
        tenant,
        triggerEventIds: ['sttrev_1']
      });

    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      type: 'map_event',
      id: 'sttrevi_1',
      triggerEventIds: ['sttrev_1'],
      webhookEventId: null
    });
    expect(slateWebhookEventInvocationFindMany).not.toHaveBeenCalled();
  });

  it('reports a shared webhook invocation once, against every event that used it', async () => {
    triggerEventFindMany.mockResolvedValue([
      { oid: BigInt(10), id: 'sttrev_1', webhookEventOid: BigInt(50) },
      { oid: BigInt(11), id: 'sttrev_2', webhookEventOid: BigInt(50) }
    ]);
    slateWebhookEventInvocationFindMany.mockResolvedValue([
      {
        id: 'wei_1',
        status: 'succeeded',
        attempt: 1,
        errorCode: null,
        errorMessage: null,
        webhookEventOid: BigInt(50),
        webhookEvent: { id: 'wev_1' },
        invocation: invocation('inv_2'),
        createdAt: new Date('2026-01-01T00:00:00Z')
      }
    ]);

    let { triggerEventInvocationService } = await import('./triggerEventInvocation');

    let res =
      await triggerEventInvocationService.getManyTriggerEventInvocationsByTriggerEventIds({
        tenant,
        triggerEventIds: ['sttrev_1', 'sttrev_2']
      });

    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      type: 'webhook_handle',
      id: 'wei_1',
      webhookEventId: 'wev_1'
    });
    expect(res[0]!.triggerEventIds).toEqual(['sttrev_1', 'sttrev_2']);

    expect(slateWebhookEventInvocationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { webhookEventOid: { in: [BigInt(50)] } }
      })
    );
  });

  it('orders the merged result by invocation time', async () => {
    triggerEventFindMany.mockResolvedValue([
      { oid: BigInt(10), id: 'sttrev_1', webhookEventOid: BigInt(50) }
    ]);
    triggerEventInvocationFindMany.mockResolvedValue([
      {
        id: 'sttrevi_1',
        status: 'succeeded',
        attempt: 1,
        errorCode: null,
        errorMessage: null,
        triggerEventOid: BigInt(10),
        invocation: invocation('inv_1'),
        createdAt: new Date('2026-01-01T00:00:02Z')
      }
    ]);
    slateWebhookEventInvocationFindMany.mockResolvedValue([
      {
        id: 'wei_1',
        status: 'succeeded',
        attempt: 1,
        errorCode: null,
        errorMessage: null,
        webhookEventOid: BigInt(50),
        webhookEvent: { id: 'wev_1' },
        invocation: invocation('inv_2'),
        createdAt: new Date('2026-01-01T00:00:01Z')
      }
    ]);

    let { triggerEventInvocationService } = await import('./triggerEventInvocation');

    let res =
      await triggerEventInvocationService.getManyTriggerEventInvocationsByTriggerEventIds({
        tenant,
        triggerEventIds: ['sttrev_1']
      });

    expect(res.map(i => i.type)).toEqual(['webhook_handle', 'map_event']);
  });

  it('carries the invocation error through', async () => {
    triggerEventFindMany.mockResolvedValue([
      { oid: BigInt(10), id: 'sttrev_1', webhookEventOid: null }
    ]);
    triggerEventInvocationFindMany.mockResolvedValue([
      {
        id: 'sttrevi_1',
        status: 'failed',
        attempt: 3,
        errorCode: 'map_failed',
        errorMessage: 'could not map the payload',
        triggerEventOid: BigInt(10),
        invocation: invocation('inv_1'),
        createdAt: new Date('2026-01-01T00:00:00Z')
      }
    ]);

    let { triggerEventInvocationService } = await import('./triggerEventInvocation');

    let res =
      await triggerEventInvocationService.getManyTriggerEventInvocationsByTriggerEventIds({
        tenant,
        triggerEventIds: ['sttrev_1']
      });

    expect(res[0]).toMatchObject({
      status: 'failed',
      attempt: 3,
      errorCode: 'map_failed',
      errorMessage: 'could not map the payload'
    });
  });
});
