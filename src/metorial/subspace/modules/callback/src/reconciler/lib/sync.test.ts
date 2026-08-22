import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  callbackUpdate: vi.fn(),
  callbackDestinationUpdateMany: vi.fn(),
  callbackInstanceFindMany: vi.fn(),
  loadFreshCallback: vi.fn(),
  isCallbackSupported: vi.fn(),
  signalCallbackUpsert: vi.fn(),
  signalCallbackArchive: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    callback: { update: mocks.callbackUpdate },
    callbackDestination: { updateMany: mocks.callbackDestinationUpdateMany },
    callbackInstance: {
      update: vi.fn(),
      findMany: mocks.callbackInstanceFindMany
    }
  }
}));

vi.mock('@metorial-subspace/provider-slates/src/client', () => ({
  slates: {
    callbackRegistration: {
      delete: vi.fn(),
      upsert: vi.fn()
    }
  }
}));

vi.mock('../../signal', () => ({
  getTenantForSignal: async () => ({ id: 'stn_1' }),
  signal: {
    callback: {
      upsert: mocks.signalCallbackUpsert,
      archive: mocks.signalCallbackArchive
    }
  }
}));

vi.mock('./state', () => ({
  TRIGGER_PAGE_SIZE: 100,
  getTenantForSlatesCached: vi.fn(),
  isCallbackSupported: mocks.isCallbackSupported,
  loadCallback: vi.fn(),
  loadFreshCallback: mocks.loadFreshCallback,
  loadCallbackInstance: vi.fn(),
  loadFreshCallbackInstance: vi.fn()
}));

import { syncSignalCallback } from './sync';

let makeCallback = (overrides: Record<string, unknown> = {}) => ({
  oid: 900n,
  id: 'callback_1',
  tenantOid: 10n,
  projectOid: 20n,
  environmentOid: 11n,
  instanceOid: 21n,
  status: 'active',
  isCallbacksV2: true,
  name: 'Order updates',
  description: null,
  pollIntervalSecondsOverride: null,
  tenant: { oid: 10n, projectOid: 20n, identifier: 'tnt_1', name: 'Tenant' },
  callbackDestinationLinks: [
    {
      callbackDestination: {
        id: 'cbd_1',
        name: 'Ops webhook',
        description: null,
        url: 'https://example.com/hooks/ops',
        method: 'POST',
        status: 'active'
      }
    }
  ],
  callbackProviderTriggers: [{ eventTypes: ['order.updated'] }],
  ...overrides
});

describe('Reconciler signal sync leaves the scoping columns untouched', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isCallbackSupported.mockReturnValue(true);
    mocks.signalCallbackUpsert.mockResolvedValue({
      destinations: [{ destination: { externalId: 'cbd_1', id: 'sed_1' } }]
    });
    mocks.signalCallbackArchive.mockResolvedValue({ destinations: [] });
    mocks.callbackInstanceFindMany.mockResolvedValue([]);
  });

  it('writes back the signal destination id without rescoping the row', async () => {
    mocks.loadFreshCallback.mockResolvedValue(makeCallback());

    await syncSignalCallback({ callbackId: 'callback_1', fresh: true });

    expect(mocks.callbackDestinationUpdateMany).toHaveBeenCalledTimes(1);
    let call = mocks.callbackDestinationUpdateMany.mock.calls[0]![0];
    expect(call.where).toEqual({ tenantOid: 10n, id: 'cbd_1' });
    expect(call.data).not.toHaveProperty('tenantOid');
    expect(call.data).not.toHaveProperty('projectOid');
    expect(call.data.signalEventDestinationId).toBe('sed_1');
  });

  it('flips the v2 flag without rescoping the callback', async () => {
    mocks.isCallbackSupported.mockReturnValue(false);
    mocks.loadFreshCallback.mockResolvedValue(makeCallback({ isCallbacksV2: false }));

    await syncSignalCallback({ callbackId: 'callback_1', fresh: true });

    expect(mocks.callbackUpdate).toHaveBeenCalledWith({
      where: { oid: 900n },
      data: { isCallbacksV2: true }
    });
  });
});
