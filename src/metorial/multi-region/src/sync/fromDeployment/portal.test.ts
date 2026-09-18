import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  processor: undefined as undefined | ((data: { portalId: string }) => Promise<void>),
  localFindUnique: vi.fn(),
  globalCreateMany: vi.fn(),
  globalFindMany: vi.fn(),
  globalUpdate: vi.fn(),
  upsertOrganization: vi.fn(),
  warn: vi.fn()
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn(() => ({ start: vi.fn() }))
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(({ name }: { name: string }) => ({
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn((processor: (data: { portalId: string }) => Promise<void>) => {
      if (name === 'global/sync/from-deployment/portal-single') {
        mocks.processor = processor;
      }

      return { start: vi.fn() };
    })
  }))
}));

vi.mock('@metorial/db', () => ({
  addAfterTransactionHook: vi.fn(),
  db: {
    portal: {
      findMany: vi.fn(),
      findUnique: mocks.localFindUnique
    }
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { listen: vi.fn() }
}));

vi.mock('../../cell', () => ({
  cell: Promise.resolve({ oid: 17 })
}));

vi.mock('../../db', () => ({
  globalDB: {
    portal: {
      createMany: mocks.globalCreateMany,
      findMany: mocks.globalFindMany,
      update: mocks.globalUpdate
    }
  }
}));

vi.mock('./organization', () => ({
  upsertOrganization: mocks.upsertOrganization
}));

import './portal';

let portal = {
  id: 'prt_new',
  status: 'active',
  name: 'Acme',
  description: null,
  slug: 'acme',
  organization: { id: 'org_1' },
  instance: { id: 'ins_1' },
  archivedAt: null,
  deletedAt: null,
  createdAt: new Date('2026-09-18T00:00:00.000Z')
};

describe('portal global registry sync', () => {
  beforeEach(() => {
    mocks.localFindUnique.mockReset().mockResolvedValue(portal);
    mocks.globalCreateMany.mockReset().mockResolvedValue({ count: 1 });
    mocks.globalFindMany.mockReset();
    mocks.globalUpdate.mockReset().mockResolvedValue(undefined);
    mocks.upsertOrganization.mockReset().mockResolvedValue(undefined);
    mocks.warn.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(mocks.warn);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates the portal after reserving its id and slug', async () => {
    mocks.globalFindMany.mockResolvedValue([
      {
        id: portal.id,
        slug: portal.slug,
        ownerOid: 17
      }
    ]);

    await expect(mocks.processor!({ portalId: portal.id })).resolves.toBeUndefined();

    expect(mocks.globalCreateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: portal.id,
        slug: portal.slug,
        ownerOid: 17
      }),
      skipDuplicates: true
    });
    expect(mocks.globalUpdate).toHaveBeenCalledWith({
      where: { id: portal.id },
      data: expect.objectContaining({ slug: portal.slug, ownerOid: 17 })
    });
  });

  it('keeps the established route when another portal owns the slug', async () => {
    mocks.globalCreateMany.mockResolvedValue({ count: 0 });
    mocks.globalFindMany.mockResolvedValue([
      {
        id: 'prt_existing',
        slug: portal.slug,
        ownerOid: 23
      }
    ]);

    await expect(mocks.processor!({ portalId: portal.id })).resolves.toBeUndefined();

    expect(mocks.globalUpdate).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledWith('global_portal_sync.slug_conflict', {
      portalId: portal.id,
      slug: portal.slug,
      ownerOid: 17,
      conflictingPortalId: 'prt_existing',
      conflictingOwnerOid: 23
    });
  });

  it('does not update an existing portal onto a slug owned by another portal', async () => {
    mocks.globalFindMany.mockResolvedValue([
      {
        id: portal.id,
        slug: 'old-acme',
        ownerOid: 17
      },
      {
        id: 'prt_existing',
        slug: portal.slug,
        ownerOid: 23
      }
    ]);

    await expect(mocks.processor!({ portalId: portal.id })).resolves.toBeUndefined();

    expect(mocks.globalUpdate).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledWith(
      'global_portal_sync.slug_conflict',
      expect.objectContaining({
        portalId: portal.id,
        conflictingPortalId: 'prt_existing'
      })
    );
  });
});
