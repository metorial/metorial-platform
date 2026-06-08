import { beforeEach, describe, expect, it, vi } from 'vitest';

let providerVersionFindFirst = vi.fn();

vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerVersion: {
      findFirst: providerVersionFindFirst
    }
  }
}));

describe('resolveProviderToolListingSpecificationOid', () => {
  beforeEach(() => {
    providerVersionFindFirst.mockReset();
  });

  it('uses the pair version specification when available', async () => {
    let { resolveProviderToolListingSpecificationOid } = await import('./toolSpecification');

    let specificationOid = await resolveProviderToolListingSpecificationOid({
      pairVersion: {
        specificationOid: 10n,
        versionOid: 20n
      }
    });

    expect(specificationOid).toBe(10n);
    expect(providerVersionFindFirst).not.toHaveBeenCalled();
  });

  it('falls back to the provider version specification while pair discovery is pending', async () => {
    let { resolveProviderToolListingSpecificationOid } = await import('./toolSpecification');
    providerVersionFindFirst.mockResolvedValue({ specificationOid: 30n });

    let specificationOid = await resolveProviderToolListingSpecificationOid({
      pairVersion: {
        specificationOid: null,
        versionOid: 20n
      }
    });

    expect(specificationOid).toBe(30n);
    expect(providerVersionFindFirst).toHaveBeenCalledWith({
      where: { oid: 20n },
      select: { specificationOid: true }
    });
  });
});
