import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  providerListingCategoryUpsert: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerListingCategory: {
      upsert: mocks.providerListingCategoryUpsert,
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  },
  getId: vi.fn(() => ({ oid: 10n, id: 'pcg_1' }))
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  resolveProviders: vi.fn(),
  resolveProviderListings: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: vi.fn(),
  resolveMetorialFacing: vi.fn()
}));

import { providerListingCategoryService } from './providerCategory';

describe('Global catalog categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providerListingCategoryUpsert.mockResolvedValue({ id: 'pcg_1' });
  });

  it('stays unscoped, so it gains neither a tenant nor a project reference', async () => {
    await providerListingCategoryService.upsertProviderListingCategory({
      input: { name: 'Web Search', slug: 'web-search', description: 'Search the web.' }
    });

    let call = mocks.providerListingCategoryUpsert.mock.calls[0]![0];
    expect(call.create).not.toHaveProperty('tenantOid');
    expect(call.create).not.toHaveProperty('projectOid');
    expect(call.update).not.toHaveProperty('tenantOid');
    expect(call.update).not.toHaveProperty('projectOid');
  });
});
