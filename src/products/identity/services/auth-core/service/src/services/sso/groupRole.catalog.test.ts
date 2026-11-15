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

vi.mock('../../db', () => ({
  db,
  withTransaction: vi.fn((handler: (transaction: typeof db) => Promise<unknown>) =>
    handler(db)
  )
}));

vi.mock('../../id', () => ({
  getId: vi.fn((type: string) => ({ oid: 100n, id: `${type}_generated` }))
}));

vi.mock('../../queues/syncCallback', () => ({
  markAresSsoTenantChanged: vi.fn(),
  markAresSsoTenantChangedForConnection: vi.fn()
}));

vi.mock('../../lib/jackson', () => ({ jackson: {} }));

import {
  ssoCatalogConnectionGroupPresenter,
  ssoCatalogConnectionRolePresenter,
  ssoCatalogDirectoryGroupPresenter,
  ssoCatalogDirectoryRolePresenter,
  ssoCatalogGroupPresenter,
  ssoCatalogRolePresenter
} from '../../apis/internal/presenters/sso';
import { ssoGroupRoleService } from './groupRole';

let tenant = { oid: 6n } as any;
let createdAt = new Date('2026-01-01');
let updatedAt = new Date('2026-01-02');

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

describe('catalog snapshot presenters', () => {
  it('flattens root groups and roles', () => {
    expect(
      ssoCatalogGroupPresenter({
        id: 'sgr_1',
        value: 'Engineering',
        displayName: 'Engineering',
        metadata: { source: 'saml' },
        createdAt,
        updatedAt
      } as any)
    ).toEqual({
      object: 'ares#ssoCatalogGroup',
      id: 'sgr_1',
      value: 'Engineering',
      displayName: 'Engineering',
      metadata: { source: 'saml' },
      createdAt,
      updatedAt
    });

    expect(
      ssoCatalogRolePresenter({
        id: 'sro_1',
        value: 'admin',
        displayName: null,
        metadata: null,
        createdAt,
        updatedAt
      } as any)
    ).toEqual({
      object: 'ares#ssoCatalogRole',
      id: 'sro_1',
      value: 'admin',
      displayName: null,
      metadata: null,
      createdAt,
      updatedAt
    });
  });

  it('flattens connection groups and roles including an unlinked root', () => {
    expect(
      ssoCatalogConnectionGroupPresenter({
        id: 'ssg_1',
        connection: { id: 'sco_1' },
        rootGroup: { id: 'sgr_1' },
        value: 'Engineering',
        displayName: null,
        metadata: null,
        createdAt,
        updatedAt
      } as any)
    ).toEqual({
      object: 'ares#ssoCatalogConnectionGroup',
      id: 'ssg_1',
      connectionId: 'sco_1',
      groupId: 'sgr_1',
      value: 'Engineering',
      displayName: null,
      metadata: null,
      createdAt,
      updatedAt
    });

    expect(
      ssoCatalogConnectionRolePresenter({
        id: 'ssr_1',
        connection: { id: 'sco_1' },
        rootRole: null,
        value: 'admin',
        displayName: null,
        metadata: null,
        createdAt,
        updatedAt
      } as any).roleId
    ).toBeNull();
  });

  it('flattens directory links to their connection-level parents', () => {
    expect(
      ssoCatalogDirectoryGroupPresenter({
        id: 'sdg_1',
        directory: { id: 'sdi_1' },
        group: { id: 'ssg_1' },
        createdAt,
        updatedAt
      } as any)
    ).toEqual({
      object: 'ares#ssoCatalogDirectoryGroup',
      id: 'sdg_1',
      directoryId: 'sdi_1',
      connectionGroupId: 'ssg_1',
      createdAt,
      updatedAt
    });

    expect(
      ssoCatalogDirectoryRolePresenter({
        id: 'sdrt_1',
        directory: { id: 'sdi_1' },
        role: { id: 'ssr_1' },
        createdAt,
        updatedAt
      } as any)
    ).toEqual({
      object: 'ares#ssoCatalogDirectoryRole',
      id: 'sdrt_1',
      directoryId: 'sdi_1',
      connectionRoleId: 'ssr_1',
      createdAt,
      updatedAt
    });
  });
});
