import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({ findMany: vi.fn(), getImageUrl: vi.fn() }));

vi.mock('@metorial/db', () => ({
  db: { consumerActor: { findMany: mocks.findMany } },
  getImageUrl: mocks.getImageUrl
}));

import { hydrateResourceOwners } from '@metorial/module-resource-actor';
import { presentOwnerActor, resourceAccessSchema } from './ownerActor';

let actor = (
  id = 'iac_1',
  type: 'person' | 'agent' | 'consumer' | 'organization_member' = 'consumer'
) => ({ id, type, name: 'Owner' });

let consumerActor = (member = false) => ({
  id: 'iac_1',
  consumer: {
    id: 'con_1',
    name: 'Consumer',
    email: 'consumer@example.com',
    user: { id: 'usr_1', image: null }
  },
  consumerProfile: {
    id: 'cpf_1',
    name: 'Profile',
    email: 'profile@example.com',
    organizationMember: member
      ? {
          id: 'mem_1',
          user: { id: 'usr_1', name: 'Member', email: 'member@example.com', image: null }
        }
      : null,
    surface: { portal: { id: 'ptl_1' } }
  }
});

describe('owner hydration and presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([consumerActor()]);
    mocks.getImageUrl.mockResolvedValue('https://example.com/avatar.png');
  });

  it('batches duplicate owners across a page and nested resources into one query', async () => {
    let resources = Array.from({ length: 50 }, () => ({
      ownerActor: actor(),
      providers: [{ config: { ownerActor: actor() } }]
    }));

    expect(await hydrateResourceOwners(resources)).toBe(resources);
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.findMany.mock.calls[0]![0].where).toEqual({ id: { in: ['iac_1'] } });
    expect(mocks.getImageUrl).toHaveBeenCalledTimes(1);
    expect(presentOwnerActor(resources[49]!.providers[0]!.config.ownerActor)).toEqual({
      type: 'consumer',
      name: 'Profile',
      image_url: 'https://example.com/avatar.png',
      email: 'profile@example.com',
      consumer: { id: 'con_1', profile_id: 'cpf_1', portal_id: 'ptl_1' }
    });
  });

  it('hydrates a single member owner with its member ID and user details', async () => {
    mocks.findMany.mockResolvedValue([consumerActor(true)]);
    let resource = await hydrateResourceOwners({
      ownerActor: actor('iac_1', 'organization_member')
    });

    expect(presentOwnerActor(resource.ownerActor)).toEqual({
      type: 'organization_member',
      name: 'Member',
      image_url: 'https://example.com/avatar.png',
      email: 'member@example.com',
      organization_member: { id: 'mem_1' },
      consumer: { id: 'con_1', profile_id: 'cpf_1', portal_id: 'ptl_1' }
    });
  });

  it('recognizes existing member actors while their stored type is being reconciled', async () => {
    mocks.findMany.mockResolvedValue([consumerActor(true)]);
    let resource = await hydrateResourceOwners({ ownerActor: actor() });

    expect(presentOwnerActor(resource.ownerActor)?.type).toBe('organization_member');
  });

  it.each(['person', 'agent'] as const)(
    'presents %s actors without querying consumer data',
    async type => {
      let resource = await hydrateResourceOwners({ identityActor: actor('iac_1', type) });

      expect(presentOwnerActor(resource.identityActor)).toEqual({
        type,
        name: 'Owner',
        image_url: null,
        email: null
      });
      expect(mocks.findMany).not.toHaveBeenCalled();
    }
  );

  it('performs no database or image work inside the presenter', async () => {
    let resource = await hydrateResourceOwners({ ownerActor: actor() });
    vi.clearAllMocks();

    presentOwnerActor(resource.ownerActor);
    presentOwnerActor(resource.ownerActor);

    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.getImageUrl).not.toHaveBeenCalled();
  });

  it('requires controller hydration for non-null owners', () => {
    expect(() => presentOwnerActor(actor())).toThrow('must be hydrated');
    expect(presentOwnerActor(null)).toBeNull();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('hydrates presentation maps and skips user-supplied metadata', async () => {
    let resource = { ownerActor: actor(), metadata: { ownerActor: actor('untrusted') } };
    await hydrateResourceOwners(new Map([['resource', resource]]));

    expect(mocks.findMany.mock.calls[0]![0].where).toEqual({ id: { in: ['iac_1'] } });
    expect(presentOwnerActor(resource.ownerActor)).toHaveProperty(
      'consumer.profile_id',
      'cpf_1'
    );
  });

  it('documents only the new access shape', () => {
    expect(Object.keys(resourceAccessSchema.properties)).toEqual([
      'type',
      'visibility',
      'owner'
    ]);
  });
});
