import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  consumerActors: vi.fn(),
  profileActors: vi.fn(),
  identities: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: { consumerActor: { findMany: mocks.consumerActors } }
}));
vi.mock('@metorial/module-resource-actor', () => ({
  resourceActorService: { listConsumerActorIds: mocks.profileActors }
}));
vi.mock('@metorial-subspace/module-identity', () => ({
  identityService: { listIdentities: mocks.identities }
}));

import { resolveActorIdsForLogFilters } from './_logFilterActors';

let instance = { oid: 10n } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profileActors.mockResolvedValue(['iac_selected']);
});

describe('profile-scoped activity filters', () => {
  it('resolves only the selected profile actors', async () => {
    await expect(
      resolveActorIdsForLogFilters({
        instance,
        consumerProfileIds: ['cop_selected']
      })
    ).resolves.toEqual(['iac_selected']);
    expect(mocks.profileActors).toHaveBeenCalledWith({
      instance,
      consumerProfileIds: ['cop_selected']
    });
  });

  it('keeps the query empty when the profile has no actors', async () => {
    mocks.profileActors.mockResolvedValue([]);
    await expect(
      resolveActorIdsForLogFilters({
        instance,
        consumerProfileIds: ['cop_empty']
      })
    ).resolves.toEqual([]);
  });

  it('does not allow actor filters to include a different profile', async () => {
    await expect(
      resolveActorIdsForLogFilters({
        instance,
        actorIds: ['iac_other'],
        consumerProfileIds: ['cop_selected']
      })
    ).resolves.toEqual([]);
  });

  it('does not allow consumer-wide filters to expand the selected profile', async () => {
    mocks.consumerActors.mockResolvedValue([{ id: 'iac_selected' }, { id: 'iac_other' }]);
    await expect(
      resolveActorIdsForLogFilters({
        instance,
        consumerIds: ['inc_shared'],
        consumerProfileIds: ['cop_selected']
      })
    ).resolves.toEqual(['iac_selected']);
  });

  it('does not allow identity filters to expand the selected profile', async () => {
    mocks.identities.mockResolvedValue({
      run: async () => ({ items: [{ actor: { id: 'iac_other' } }] })
    });
    await expect(
      resolveActorIdsForLogFilters({
        instance,
        identityIds: ['idn_other'],
        consumerProfileIds: ['cop_selected']
      })
    ).resolves.toEqual([]);
  });

  it('preserves unfiltered requests', async () => {
    await expect(resolveActorIdsForLogFilters({ instance })).resolves.toBeUndefined();
    expect(mocks.profileActors).not.toHaveBeenCalled();
  });
});
