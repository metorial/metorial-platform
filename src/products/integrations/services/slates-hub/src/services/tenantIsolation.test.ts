import { beforeEach, describe, expect, it, vi } from 'vitest';

let dbMocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn()
}));

let functionBayMocks = vi.hoisted(() => ({
  upsert: vi.fn()
}));

vi.mock('../db', () => ({
  db: {
    tenant: {
      findFirst: dbMocks.findFirst,
      update: dbMocks.update
    }
  }
}));

vi.mock('../functionBay', () => ({
  functionBay: {
    tenant: {
      upsert: functionBayMocks.upsert
    }
  }
}));

import { tenantIsolationService } from './tenantIsolation';

let tenant = {
  oid: 10n,
  id: 'shtn_1',
  identifier: 'mte-pro-10',
  name: 'Acme',
  tenantIsolationEnabled: false,
  functionBayTenantId: null as string | null,
  functionBayTenantIdentifier: null as string | null
};

describe('tenantIsolationService', () => {
  beforeEach(() => {
    dbMocks.findFirst.mockReset();
    dbMocks.update.mockReset();
    functionBayMocks.upsert.mockReset();
    dbMocks.update.mockResolvedValue({});
    functionBayMocks.upsert.mockResolvedValue({
      id: 'fbay_tenant_1',
      identifier: 'mte-pro-10'
    });
    tenant = {
      oid: 10n,
      id: 'shtn_1',
      identifier: 'mte-pro-10',
      name: 'Acme',
      tenantIsolationEnabled: false,
      functionBayTenantId: null,
      functionBayTenantIdentifier: null
    };
  });

  it('reports isolation as disabled when the tenant does not exist yet', async () => {
    dbMocks.findFirst.mockResolvedValue(null);

    await expect(tenantIsolationService.get({ tenantId: 'mte-pro-10' })).resolves.toEqual({
      enabled: false,
      tenantId: null,
      identifier: null
    });
  });

  it('reads isolation from the tenant', async () => {
    dbMocks.findFirst.mockResolvedValue({
      id: tenant.id,
      identifier: tenant.identifier,
      tenantIsolationEnabled: true
    });

    await expect(tenantIsolationService.get({ tenantId: tenant.identifier })).resolves.toEqual(
      {
        enabled: true,
        tenantId: tenant.id,
        identifier: tenant.identifier
      }
    );
  });

  it('enables isolation on the function bay tenant for that slates tenant', async () => {
    dbMocks.findFirst.mockResolvedValue(tenant);

    await expect(
      tenantIsolationService.update({ tenantId: tenant.identifier, enabled: true })
    ).resolves.toEqual({
      enabled: true,
      tenantId: tenant.id,
      identifier: tenant.identifier
    });

    expect(dbMocks.update).toHaveBeenCalledWith({
      where: { oid: tenant.oid },
      data: { tenantIsolationEnabled: true }
    });
    expect(functionBayMocks.upsert).toHaveBeenCalledWith({
      identifier: tenant.identifier,
      name: tenant.name,
      hasAutomaticEnclaveOverride: true
    });
    expect(dbMocks.update).toHaveBeenCalledWith({
      where: { oid: tenant.oid },
      data: {
        functionBayTenantId: 'fbay_tenant_1',
        functionBayTenantIdentifier: 'mte-pro-10'
      }
    });
  });

  it('updates an existing function bay tenant without replacing its link', async () => {
    dbMocks.findFirst.mockResolvedValue({
      ...tenant,
      functionBayTenantId: 'fbay_tenant_1',
      functionBayTenantIdentifier: 'mte-pro-10'
    });

    await tenantIsolationService.update({ tenantId: tenant.id, enabled: false });

    expect(functionBayMocks.upsert).toHaveBeenCalledWith({
      identifier: 'mte-pro-10',
      name: tenant.name,
      hasAutomaticEnclaveOverride: false
    });
    expect(dbMocks.update).toHaveBeenCalledTimes(1);
  });

  it('restores the previous setting when function bay rejects the update', async () => {
    dbMocks.findFirst.mockResolvedValue(tenant);
    functionBayMocks.upsert.mockRejectedValue(new Error('function bay unavailable'));

    await expect(
      tenantIsolationService.update({ tenantId: tenant.identifier, enabled: true })
    ).rejects.toThrow('function bay unavailable');

    expect(dbMocks.update).toHaveBeenNthCalledWith(1, {
      where: { oid: tenant.oid },
      data: { tenantIsolationEnabled: true }
    });
    expect(dbMocks.update).toHaveBeenNthCalledWith(2, {
      where: { oid: tenant.oid },
      data: { tenantIsolationEnabled: false }
    });
  });
});
