import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  listingFindFirst: vi.fn(),
  providerFindFirst: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/error', () => ({
  ServiceError: class ServiceError extends Error {},
  notFoundError: (resource: string) => ({ resource })
}));

vi.mock('@lowerdeck/pagination', () => ({ Paginator: {} }));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerListing: { findFirst: mocks.listingFindFirst },
    provider: { findFirst: mocks.providerFindFirst }
  }
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeDateFilter: vi.fn(),
  resolveProviderCategories: vi.fn(),
  resolveProviderCollections: vi.fn(),
  resolveProviderGroups: vi.fn(),
  resolvePublishers: vi.fn()
}));

vi.mock('@metorial-subspace/module-search', () => ({
  voyager: {},
  voyagerIndex: {},
  voyagerSource: {}
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: vi.fn(async () => ({ oid: 1n })),
  resolveMetorialFacing: vi.fn()
}));

vi.mock('./provider', () => ({
  getProviderCapabilityFilter: vi.fn(),
  getProviderEnvironmentVisibilityFilter: vi.fn(() => undefined),
  providerInclude: {}
}));

import { providerListingService } from './providerListing';

let listing = { oid: 5n, id: 'lst_5' };

describe('providerListingService.getProviderListingByIdInternal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listingFindFirst.mockResolvedValue(null);
    mocks.providerFindFirst.mockResolvedValue(null);
  });

  it('resolves ids and slugs without touching the provider table', async () => {
    mocks.listingFindFirst.mockResolvedValueOnce({ oid: 5n }).mockResolvedValueOnce(listing);

    let result = await providerListingService.getProviderListingByIdInternal({
      providerListingId: 'github'
    });

    expect(result).toBe(listing);
    expect(mocks.providerFindFirst).not.toHaveBeenCalled();
    expect(mocks.listingFindFirst).toHaveBeenCalledTimes(2);
    expect(mocks.listingFindFirst.mock.calls[0]![0].where.AND[0]).toEqual({
      OR: [{ id: 'github' }, { slug: 'github' }, { prettySlug: 'github' }]
    });
    expect(mocks.listingFindFirst.mock.calls[1]![0].where).toEqual({ oid: 5n });
  });

  it('falls back to aliases', async () => {
    mocks.listingFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ oid: 5n })
      .mockResolvedValueOnce(listing);

    await providerListingService.getProviderListingByIdInternal({ providerListingId: 'gh' });

    expect(mocks.listingFindFirst.mock.calls[1]![0].where.AND[0]).toEqual({
      aliases: { has: 'gh' }
    });
    expect(mocks.providerFindFirst).not.toHaveBeenCalled();
  });

  it('falls back to the provider id or global identifier', async () => {
    mocks.listingFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ oid: 5n })
      .mockResolvedValueOnce(listing);
    mocks.providerFindFirst.mockResolvedValue({ oid: 9n });

    let result = await providerListingService.getProviderListingByIdInternal({
      providerListingId: 'pro_9'
    });

    expect(result).toBe(listing);
    expect(mocks.providerFindFirst).toHaveBeenCalledWith({
      where: { OR: [{ id: 'pro_9' }, { globalIdentifier: 'pro_9' }] },
      select: { oid: true }
    });
    expect(mocks.listingFindFirst.mock.calls[2]![0].where.AND[0]).toEqual({ providerOid: 9n });
  });

  it('applies the public visibility filter to every candidate lookup', async () => {
    await expect(
      providerListingService.getProviderListingByIdInternal({ providerListingId: 'nope' })
    ).rejects.toThrow();

    for (let [args] of mocks.listingFindFirst.mock.calls) {
      expect(args.where.AND[1]).toEqual({ OR: [{ isPublic: true }] });
    }
  });
});
