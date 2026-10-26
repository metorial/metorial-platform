import { describe, expect, it } from 'vitest';
import { getProviderSearchTenantIds } from './searchTenantIds';

describe('getProviderSearchTenantIds', () => {
  it('makes public providers searchable by every tenant', () => {
    expect(getProviderSearchTenantIds({ access: 'public', ownerTenant: null })).toEqual([]);
  });

  it('restricts tenant providers to their owner tenant', () => {
    expect(
      getProviderSearchTenantIds({ access: 'tenant', ownerTenant: { id: 'ten_owner' } })
    ).toEqual(['ten_owner']);
  });

  it('hides tenant providers without an owner from every tenant', () => {
    expect(getProviderSearchTenantIds({ access: 'tenant', ownerTenant: null })).toEqual([
      '$$NONE$$'
    ]);
  });
});
