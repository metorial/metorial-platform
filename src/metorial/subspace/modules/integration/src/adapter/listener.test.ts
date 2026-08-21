import { describe, expect, it, vi } from 'vitest';

let { removeAdapterInstance, syncAdapterInstanceProviders, syncAdapterInstanceStatus, syncAdapterProviders } =
  vi.hoisted(() => ({
    removeAdapterInstance: vi.fn(),
    syncAdapterInstanceProviders: vi.fn(),
    syncAdapterInstanceStatus: vi.fn(),
    syncAdapterProviders: vi.fn()
  }));

let { tx } = vi.hoisted(() => {
  let createModel = () => ({
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn()
  });
  return {
    tx: {
      adapterIntegration: createModel(),
      adapterIntegrationInstance: createModel(),
      tenant: createModel(),
      environment: createModel()
    }
  };
});

vi.mock('@metorial-subspace/db', () => ({
  withTransaction: async (cb: (db: any) => Promise<any>) => await cb(tx)
}));

vi.mock('./primitives', () => ({
  removeAdapterInstance,
  removeAdapterIntegration: vi.fn(),
  syncAdapterInstanceProviders,
  syncAdapterInstanceStatus,
  syncAdapterProviders
}));

import { adapterCoordinationListener } from './listener';

describe('adapter coordination listener', () => {
  it('does not auto-create an adapter instance when an integration instance is created', async () => {
    tx.adapterIntegrationInstance.findMany.mockResolvedValue([]);

    await adapterCoordinationListener.onEvent({
      kind: 'integrationInstance.created',
      integration: { oid: 21n } as any,
      integrationInstance: { oid: 55n, tenantOid: 1n, environmentOid: 3n } as any
    });

    expect(tx.adapterIntegrationInstance.findMany).toHaveBeenCalled();
    expect(syncAdapterInstanceStatus).not.toHaveBeenCalled();
    expect(syncAdapterInstanceProviders).not.toHaveBeenCalled();
  });

  it('syncs draft and active adapter instance status from the integration instance', async () => {
    tx.adapterIntegrationInstance.findMany.mockResolvedValue([{ oid: 300n }]);

    await adapterCoordinationListener.onEvent({
      kind: 'integrationInstance.updated',
      integration: { oid: 21n } as any,
      integrationInstance: {
        oid: 55n,
        status: 'active',
        tenantOid: 1n,
        environmentOid: 3n
      } as any
    });

    expect(syncAdapterInstanceStatus).toHaveBeenCalled();
  });

  it('syncs adapter providers when an integration provider is created', async () => {
    tx.adapterIntegration.findMany.mockResolvedValue([{ oid: 100n }]);

    await adapterCoordinationListener.onEvent({
      kind: 'integrationProvider.created',
      integration: { oid: 21n } as any,
      integrationProvider: { oid: 70n } as any
    });

    expect(syncAdapterProviders).toHaveBeenCalled();
  });
});
