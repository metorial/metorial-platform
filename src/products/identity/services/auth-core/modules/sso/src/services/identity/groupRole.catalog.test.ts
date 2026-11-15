import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    ssoGroup: { findMany: vi.fn() },
    ssoRole: { findMany: vi.fn() },
    ssoConnectionGroup: { findMany: vi.fn() },
    ssoConnectionRole: { findMany: vi.fn() },
    ssoDirectoryGroup: { findMany: vi.fn() },
    ssoDirectoryRole: { findMany: vi.fn() }
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: { create: vi.fn() }
}));

vi.mock('@mtsrc/auth-core-db/src/db', () => ({
  db,
  withTransaction: vi.fn((handler: (transaction: typeof db) => Promise<unknown>) =>
    handler(db)
  )
}));

vi.mock('@mtsrc/auth-core-db/src/id', () => ({
  getId: vi.fn((type: string) => ({ oid: 100n, id: `${type}_generated` }))
}));

vi.mock('@mtsrc/auth-core-module-sync', () => ({
  markAresSsoTenantChanged: vi.fn(),
  markAresSsoTenantChangedForConnection: vi.fn()
}));

vi.mock('@mtsrc/auth-core-module-user/src/definitions/terms', () => ({ terms: {} }));

vi.mock('../../lib/jackson', () => ({ jackson: {} }));

import { ssoGroupRoleService } from './groupRole';

let tenant = { oid: 6n } as any;

describe('tenant catalog snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (let model of Object.values(db)) model.findMany.mockResolvedValue([]);
  });

  it('scopes every catalog level to the tenant and orders it deterministically', async () => {
    await ssoGroupRoleService.getTenantCatalog({ tenant });

    expect(db.ssoGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantOid: tenant.oid }, orderBy: { id: 'asc' } })
    );
    expect(db.ssoRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantOid: tenant.oid }, orderBy: { id: 'asc' } })
    );
    expect(db.ssoConnectionGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { connection: { tenantOid: tenant.oid } },
        orderBy: { id: 'asc' }
      })
    );
    expect(db.ssoConnectionRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { connection: { tenantOid: tenant.oid } },
        orderBy: { id: 'asc' }
      })
    );
    expect(db.ssoDirectoryGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { directory: { connection: { tenantOid: tenant.oid } } },
        orderBy: { id: 'asc' }
      })
    );
    expect(db.ssoDirectoryRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { directory: { connection: { tenantOid: tenant.oid } } },
        orderBy: { id: 'asc' }
      })
    );
  });

  it('returns the three catalog levels for the tenant', async () => {
    db.ssoGroup.findMany.mockResolvedValue([{ id: 'sgr_1' }]);
    db.ssoRole.findMany.mockResolvedValue([{ id: 'sro_1' }]);
    db.ssoConnectionGroup.findMany.mockResolvedValue([{ id: 'ssg_1' }]);
    db.ssoConnectionRole.findMany.mockResolvedValue([{ id: 'ssr_1' }]);
    db.ssoDirectoryGroup.findMany.mockResolvedValue([{ id: 'sdg_1' }]);
    db.ssoDirectoryRole.findMany.mockResolvedValue([{ id: 'sdrt_1' }]);

    let catalog = await ssoGroupRoleService.getTenantCatalog({ tenant });

    expect(catalog).toEqual({
      groups: [{ id: 'sgr_1' }],
      roles: [{ id: 'sro_1' }],
      connectionGroups: [{ id: 'ssg_1' }],
      connectionRoles: [{ id: 'ssr_1' }],
      directoryGroups: [{ id: 'sdg_1' }],
      directoryRoles: [{ id: 'sdrt_1' }]
    });
  });
});
