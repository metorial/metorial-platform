import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findCallback: vi.fn(),
  findCallbackInstance: vi.fn(),
  getTenantForSignal: vi.fn(),
  recordEvent: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  CallbackDestinationStatus: { active: 'active' },
  db: {
    callback: { findFirst: mocks.findCallback },
    callbackInstance: { findFirst: mocks.findCallbackInstance }
  },
  getId: vi.fn(),
  snowflake: { nextId: vi.fn() },
  withTransaction: vi.fn()
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: () => ({ noParent: { status: { not: 'deleted' } } }),
  normalizeStatusForList: () => ({ noParent: {} }),
  resolveProviderDeployments: vi.fn()
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  providerDeploymentInternalService: {}
}));

vi.mock('./callbackRegistration', () => ({
  callbackRegistrationService: { syncCallback: vi.fn() }
}));

vi.mock('../signal', () => ({
  getTenantForSignal: mocks.getTenantForSignal,
  getInternalSignal: () => ({
    callback: { recordDashboardTestEvent: mocks.recordEvent }
  })
}));

import { callbackService } from './callback';

let tenant = { oid: 1n, id: 'ten_authorized' } as any;
let solution = { oid: 2n, id: 'sol_authorized' } as any;
let environment = { oid: 3n, id: 'env_authorized' } as any;
let callback = {
  oid: 4n,
  id: 'clb_authorized',
  status: 'active',
  isCallbacksV2: true
} as any;
let storedInstance = {
  id: 'cbi_authorized',
  callbackOid: callback.oid,
  status: 'attached',
  isParentDeleted: false
};
let originalFetch = globalThis.fetch;

let input = (overrides: Record<string, unknown> = {}) =>
  ({
    tenant,
    solution,
    environment,
    callbackId: callback.id,
    callbackInstanceId: storedInstance.id,
    eventId: 'dashboard_test:stable-action-id',
    input: {
      eventType: ' dashboard.test ',
      payloadJson: '{"test":true}'
    },
    ...overrides
  }) as any;

beforeEach(() => {
  vi.resetAllMocks();
  globalThis.fetch = vi.fn() as any;
  mocks.findCallback.mockImplementation(async ({ where }: any) => {
    if (
      where.id !== callback.id ||
      where.tenantOid !== tenant.oid ||
      where.solutionOid !== solution.oid ||
      where.environmentOid !== environment.oid
    ) {
      return null;
    }
    return callback;
  });
  mocks.findCallbackInstance.mockImplementation(async ({ where }: any) => {
    if (
      where.id !== storedInstance.id ||
      where.callbackOid !== storedInstance.callbackOid ||
      where.status !== storedInstance.status ||
      where.isParentDeleted !== storedInstance.isParentDeleted
    ) {
      return null;
    }
    return { id: storedInstance.id };
  });
  mocks.getTenantForSignal.mockResolvedValue({ id: 'signal_tenant_authorized' });
  let recorded = new Map<string, any>();
  mocks.recordEvent.mockImplementation(async (event: any) => {
    let existing = recorded.get(event.eventId);
    if (existing) return existing;
    let result = {
      object: 'callback.event',
      id: 'cbe_dashboard_test',
      externalId: event.eventId,
      eventId: 'evt_dashboard_test',
      type: event.eventType,
      sourceId: event.sourceId,
      triggerId: null,
      triggerKey: event.triggerKey,
      callbackId: event.callbackId,
      callbackInstanceId: event.callbackInstanceId,
      input: { test: true },
      output: { test: true },
      status: 'succeeded',
      error: null,
      deliveryStatus: 'pending',
      createdAt: new Date('2026-08-15T08:00:00.000Z'),
      updatedAt: new Date('2026-08-15T08:00:00.000Z')
    };
    recorded.set(event.eventId, result);
    return result;
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Subspace dashboard synthetic event production service', () => {
  it('authorizes the exact callback and attached instance, then records exact Signal fields', async () => {
    let result = await callbackService.sendDashboardTestEvent(input());

    expect(mocks.findCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: callback.id,
          tenantOid: tenant.oid,
          solutionOid: solution.oid,
          environmentOid: environment.oid,
          status: { not: 'deleted' }
        })
      })
    );
    expect(mocks.findCallbackInstance).toHaveBeenCalledWith({
      where: {
        id: storedInstance.id,
        callbackOid: callback.oid,
        status: 'attached',
        isParentDeleted: false
      },
      select: { id: true }
    });
    expect(mocks.recordEvent).toHaveBeenCalledWith({
      tenantId: 'signal_tenant_authorized',
      callbackId: callback.id,
      eventId: 'dashboard_test:stable-action-id',
      callbackInstanceId: storedInstance.id,
      eventType: 'dashboard.test',
      payloadJson: '{"test":true}'
    });
    expect(result).toMatchObject({
      id: 'cbe_dashboard_test',
      sourceId: 'dashboard_test',
      triggerKey: 'dashboard_test'
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['tenant', { tenant: { ...tenant, oid: 100n } }],
    ['solution', { solution: { ...solution, oid: 200n } }],
    ['environment', { environment: { ...environment, oid: 300n } }],
    ['callback', { callbackId: 'clb_other' }]
  ])('rejects the wrong %s scope before Signal', async (_, overrides) => {
    await expect(callbackService.sendDashboardTestEvent(input(overrides))).rejects.toThrow();
    expect(mocks.findCallbackInstance).not.toHaveBeenCalled();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong callback instance', { callbackInstanceId: 'cbi_other' }],
    ['detached instance', { stored: { status: 'detached' } }],
    ['parent-deleted instance', { stored: { isParentDeleted: true } }]
  ])('rejects a %s before Signal', async (_, scenario) => {
    if ('stored' in scenario) Object.assign(storedInstance, scenario.stored);

    await expect(
      callbackService.sendDashboardTestEvent(
        input(
          'callbackInstanceId' in scenario
            ? { callbackInstanceId: scenario.callbackInstanceId }
            : {}
        )
      )
    ).rejects.toThrow();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();

    storedInstance.status = 'attached';
    storedInstance.isParentDeleted = false;
  });

  it.each([
    ['deleted callback', { status: 'deleted', isCallbacksV2: true }],
    ['archived callback', { status: 'archived', isCallbacksV2: true }],
    ['legacy callback', { status: 'active', isCallbacksV2: false }]
  ])('rejects a %s before instance lookup or Signal', async (_, callbackState) => {
    Object.assign(callback, callbackState);

    await expect(callbackService.sendDashboardTestEvent(input())).rejects.toThrow();
    expect(mocks.findCallbackInstance).not.toHaveBeenCalled();
    expect(mocks.recordEvent).not.toHaveBeenCalled();

    callback.status = 'active';
    callback.isCallbacksV2 = true;
  });

  it('propagates the same Core event ID across an ambiguous RPC retry', async () => {
    let first = await callbackService.sendDashboardTestEvent(input());
    let retry = await callbackService.sendDashboardTestEvent(input());

    expect(retry.id).toBe(first.id);
    expect(mocks.recordEvent).toHaveBeenCalledTimes(2);
    expect(mocks.recordEvent.mock.calls[0]![0].eventId).toBe(
      mocks.recordEvent.mock.calls[1]![0].eventId
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['caller-controlled event ID', { eventId: 'vendor-event-id' }],
    ['empty event type', { input: { eventType: '  ', payloadJson: '{}' } }],
    ['non-object payload', { input: { eventType: 'dashboard.test', payloadJson: '[]' } }]
  ])('rejects %s before Signal', async (_, overrides) => {
    await expect(callbackService.sendDashboardTestEvent(input(overrides))).rejects.toThrow();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });
});
