import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getSubspaceSystemAuditScope: vi.fn(),
  metorialInstance: { findUniqueOrThrow: vi.fn() }
}));

vi.mock('./metorialDb', () => ({
  metorialDb: { instance: mocks.metorialInstance }
}));

vi.mock('./systemAuditScope', () => ({
  getSubspaceSystemAuditScope: mocks.getSubspaceSystemAuditScope
}));

import { getSubspaceSystemProviderEventBase } from './systemProviderEventBase';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.metorialInstance.findUniqueOrThrow.mockResolvedValue({ id: 'ins_1', oid: 3n });
  mocks.getSubspaceSystemAuditScope.mockResolvedValue({
    organizationOid: 1n,
    instanceOid: 3n,
    actor: { type: 'system', id: 'subspace/providerSetupSession' },
    context: { ip: '' }
  });
});

describe('getSubspaceSystemProviderEventBase', () => {
  it('combines the Metorial instance with a system audit scope', async () => {
    let eventBase = await getSubspaceSystemProviderEventBase({
      job: 'subspace/providerSetupSession',
      instanceOid: 3n
    });

    expect(eventBase).toMatchObject({
      instance: { id: 'ins_1', oid: 3n },
      auditScope: {
        organizationOid: 1n,
        instanceOid: 3n,
        actor: { type: 'system', id: 'subspace/providerSetupSession' }
      }
    });
  });

  it('rejects event bases that cannot be tied to an instance', async () => {
    await expect(
      getSubspaceSystemProviderEventBase({
        job: 'subspace/providerSetupSession',
        instanceOid: null
      })
    ).rejects.toThrow('Cannot create provider Fabric event without an instance');
    expect(mocks.metorialInstance.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
