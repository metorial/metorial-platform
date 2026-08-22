import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  callbackFindFirst: vi.fn(),
  callbackInstanceFindFirst: vi.fn(),
  getTenantForSignal: vi.fn(),
  resolveAuthorizedCallbackIdsInternal: vi.fn(),
  listEvents: vi.fn(),
  getEvent: vi.fn(),
  recordDashboardTestEvent: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({ build: () => factory() }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  CallbackStatus: { active: 'active', archived: 'archived', deleted: 'deleted' },
  db: {
    callback: { findFirst: mocks.callbackFindFirst },
    callbackInstance: { findFirst: mocks.callbackInstanceFindFirst }
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: async () => ({ oid: 30n }),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('../signal', () => ({
  getTenantForSignal: mocks.getTenantForSignal,
  getInternalSignal: () => ({
    callback: { recordDashboardTestEvent: mocks.recordDashboardTestEvent }
  }),
  signal: {
    callback: {
      getEvent: mocks.getEvent,
      listEvents: mocks.listEvents,
      listEventsByIds: vi.fn()
    }
  }
}));

vi.mock('./webhookEvent', () => ({
  webhookEventService: {
    resolveAuthorizedCallbackIdsInternal: mocks.resolveAuthorizedCallbackIdsInternal
  }
}));

import { callbackEventService } from './callbackEvent';

describe('callback dashboard test events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callbackFindFirst.mockResolvedValue({
      oid: 40n,
      id: 'callback_1',
      status: 'active'
    });
    mocks.callbackInstanceFindFirst.mockResolvedValue({ id: 'cbi_1' });
    mocks.getTenantForSignal.mockResolvedValue({ id: 'signal_tenant_1' });
    mocks.resolveAuthorizedCallbackIdsInternal.mockResolvedValue([
      'callback-active',
      'callback-archived'
    ]);
    mocks.listEvents.mockResolvedValue({
      object: 'list',
      items: [],
      pagination: { has_more_after: false, has_more_before: false }
    });
    mocks.recordDashboardTestEvent.mockResolvedValue({
      id: 'callback_event_1',
      externalId: 'dashboard_test:request_1',
      type: 'dashboard.test',
      sourceId: 'dashboard_test',
      triggerKey: 'dashboard_test',
      input: { ok: true },
      output: { ok: true },
      status: 'succeeded',
      error: null,
      deliveryStatus: 'pending',
      callbackId: 'callback_1',
      callbackInstanceId: 'cbi_1',
      createdAt: new Date('2026-08-21T12:00:00.000Z')
    });
  });

  it('validates ownership and sends through the authenticated Signal client', async () => {
    let result = await callbackEventService.sendDashboardTestEventInternal({
      tenant: { oid: 10n },
      environment: { oid: 20n },
      callbackId: 'callback_1',
      callbackInstanceId: 'cbi_1',
      eventId: 'dashboard_test:request_1',
      input: { eventType: ' dashboard.test ', payloadJson: '{"ok":true}' }
    } as any);

    expect(mocks.callbackFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'callback_1',
        tenantOid: 10n,
        solutionOid: 30n,
        environmentOid: 20n,
        status: { notIn: ['deleted'] }
      }
    });
    expect(mocks.callbackInstanceFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'cbi_1',
        callbackOid: 40n,
        status: 'attached',
        isParentDeleted: false
      },
      select: { id: true }
    });
    expect(mocks.recordDashboardTestEvent).toHaveBeenCalledWith({
      tenantId: 'signal_tenant_1',
      callbackId: 'callback_1',
      eventId: 'dashboard_test:request_1',
      callbackInstanceId: 'cbi_1',
      eventType: 'dashboard.test',
      payloadJson: '{"ok":true}'
    });
    expect(result).toMatchObject({
      id: 'callback_event_1',
      callbackId: 'callback_1',
      callbackInstanceId: 'cbi_1'
    });
  });

  it.each([
    ['event ID', 'invalid', 'dashboard.test', '{"ok":true}'],
    ['event type', 'dashboard_test:request_1', '   ', '{"ok":true}'],
    ['payload', 'dashboard_test:request_1', 'dashboard.test', '[]']
  ])(
    'rejects an invalid %s before database lookup',
    async (_label, eventId, eventType, payloadJson) => {
      await expect(
        callbackEventService.sendDashboardTestEventInternal({
          tenant: { oid: 10n },
          environment: { oid: 20n },
          callbackId: 'callback_1',
          callbackInstanceId: 'cbi_1',
          eventId,
          input: { eventType, payloadJson }
        } as any)
      ).rejects.toThrow();
      expect(mocks.callbackFindFirst).not.toHaveBeenCalled();
      expect(mocks.recordDashboardTestEvent).not.toHaveBeenCalled();
    }
  );

  it('rejects an instance that is not attached to the scoped callback', async () => {
    mocks.callbackInstanceFindFirst.mockResolvedValue(null);

    await expect(
      callbackEventService.sendDashboardTestEventInternal({
        tenant: { oid: 10n },
        environment: { oid: 20n },
        callbackId: 'callback_1',
        callbackInstanceId: 'other_cbi',
        eventId: 'dashboard_test:request_1',
        input: { eventType: 'dashboard.test', payloadJson: '{"ok":true}' }
      } as any)
    ).rejects.toThrow();
    expect(mocks.recordDashboardTestEvent).not.toHaveBeenCalled();
  });

  it('applies the active-and-archived allowlist to instance-wide list and get', async () => {
    await callbackEventService.listCallbackEventsForScopeInternal({
      tenant: { oid: 10n },
      environment: { oid: 20n },
      input: { callbackIds: ['callback-foreign'] }
    } as any);
    expect(mocks.listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ callbackIds: [] })
    );

    mocks.getEvent.mockResolvedValue({
      id: 'callback-event-1',
      externalId: null,
      type: 'message.created',
      sourceId: 'source-1',
      triggerKey: 'trigger-1',
      input: null,
      output: null,
      status: 'succeeded',
      error: null,
      deliveryStatus: 'sent',
      callbackId: 'callback-archived',
      callbackInstanceId: 'callback-instance-1',
      createdAt: new Date('2026-08-21T12:00:00.000Z')
    });
    await expect(
      callbackEventService.getCallbackEventForScopeInternal({
        tenant: { oid: 10n },
        environment: { oid: 20n },
        callbackEventId: 'callback-event-1'
      } as any)
    ).resolves.toMatchObject({ callbackId: 'callback-archived' });

    mocks.getEvent.mockResolvedValue({ callbackId: 'callback-foreign' });
    await expect(
      callbackEventService.getCallbackEventForScopeInternal({
        tenant: { oid: 10n },
        environment: { oid: 20n },
        callbackEventId: 'callback-event-2'
      } as any)
    ).rejects.toMatchObject({ data: { code: 'not_found' } });
  });
});
