import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  profileActors: vi.fn(),
  listCredentials: vi.fn(),
  run: vi.fn()
}));

vi.mock('@metorial/module-resource-actor', () => ({
  resourceActorService: { listConsumerActorIds: mocks.profileActors }
}));
vi.mock('@metorial-subspace/module-identity', () => ({
  identityCredentialService: { listIdentityCredentials: mocks.listCredentials },
  identityDelegationConfigService: {},
  identityService: {}
}));
vi.mock('@metorial/rest', () => ({
  Controller: { create: (_config: unknown, handlers: unknown) => handlers }
}));
vi.mock('../../../middleware/instanceGroup', () => {
  let chain: any = new Proxy(
    {},
    {
      get: (_, key) => (key === 'do' ? (handler: unknown) => handler : () => chain)
    }
  );

  return { instanceGroup: chain, instancePath: () => [] };
});
vi.mock('../../../middleware/checkAccess', () => ({ checkAccess: vi.fn() }));
vi.mock('../../../middleware/hasFlags', () => ({ hasFlags: vi.fn() }));
vi.mock('@metorial/presenters', () => ({ identityCredentialPresenter: {} }));

import { identityCredentialController } from './identityCredential';

let instance = { oid: 1n };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profileActors.mockResolvedValue(['iac_profile_person', 'iac_profile_agent']);
  mocks.listCredentials.mockResolvedValue({ run: mocks.run });
  mocks.run.mockResolvedValue({ items: [], pagination: {} });
});

let list = (query: Record<string, unknown>) =>
  (identityCredentialController as any).list({ instance, query });

describe('profile credential filtering', () => {
  it('includes every actor of the selected profile across identities', async () => {
    await list({ consumer_profile_id: 'cop_selected' });

    expect(mocks.profileActors).toHaveBeenCalledWith({
      instance,
      consumerProfileIds: ['cop_selected']
    });
    expect(mocks.listCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        instance,
        actorIds: ['iac_profile_person', 'iac_profile_agent']
      })
    );
  });

  it('keeps an empty profile filter empty', async () => {
    mocks.profileActors.mockResolvedValue([]);
    await list({ consumer_profile_id: 'cop_empty' });

    expect(mocks.listCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ actorIds: [] })
    );
  });

  it('does not allow an actor filter to broaden the selected profile', async () => {
    await list({ consumer_profile_id: 'cop_selected', actor_id: 'iac_other_profile' });

    expect(mocks.listCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ actorIds: [] })
    );
  });

  it('preserves queries without a profile filter', async () => {
    await list({ actor_id: 'iac_other_profile' });

    expect(mocks.profileActors).not.toHaveBeenCalled();
    expect(mocks.listCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        actorIds: ['iac_other_profile']
      })
    );
  });
});
