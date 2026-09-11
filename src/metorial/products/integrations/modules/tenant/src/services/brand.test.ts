import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  brandUpsert: vi.fn(),
  brandFindFirst: vi.fn(),
  tenantFindUnique: vi.fn(),
  getId: vi.fn()
}));

vi.mock('@lowerdeck/error', () => ({
  notFoundError: vi.fn((entity: string) => ({ entity })),
  ServiceError: class ServiceError extends Error {
    constructor(public error: unknown) {
      super('ServiceError');
    }
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  Prisma: { DbNull: 'DbNull' },
  getId: mocks.getId,
  db: {
    brand: {
      upsert: mocks.brandUpsert,
      findFirst: mocks.brandFindFirst
    },
    tenant: {
      findUnique: mocks.tenantFindUnique
    }
  }
}));

import { brandService } from './brand';

let tenant = {
  oid: 20n,
  id: 'ktn_tenant',
  projectOid: 2n
};

describe('brandService.upsertBrand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getId.mockReturnValue({ oid: 99n, id: 'kbd_99' });
    mocks.brandUpsert.mockResolvedValue({ oid: 99n, identifier: tenant.id });
  });

  it('stamps projectOid from the tenant on create and update', async () => {
    await brandService.upsertBrand({
      input: {
        name: 'Acme',
        image: null,
        for: { type: 'tenant', tenant: tenant as any }
      }
    });

    expect(mocks.brandUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { identifier: tenant.id },
        update: expect.objectContaining({
          name: 'Acme',
          projectOid: tenant.projectOid
        }),
        create: expect.objectContaining({
          name: 'Acme',
          identifier: tenant.id,
          tenantOid: tenant.oid,
          projectOid: tenant.projectOid
        })
      })
    );
  });

  it('does not stamp tenant or project oids for identifier-scoped brands', async () => {
    await brandService.upsertBrand({
      input: {
        name: 'Custom',
        image: null,
        for: { type: 'identifier', identifier: 'custom' }
      }
    });

    let call = mocks.brandUpsert.mock.calls[0][0];
    expect(call.create.tenantOid).toBeUndefined();
    expect(call.create.projectOid).toBeUndefined();
    expect(call.update.projectOid).toBeUndefined();
  });
});
