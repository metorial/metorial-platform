import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  isStoreResourceFlagEnabled: vi.fn(),
  findConsumerProfile: vi.fn(),
  findOrganizationMember: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    consumerProfile: { findUnique: mocks.findConsumerProfile },
    organizationMember: { findFirst: mocks.findOrganizationMember }
  }
}));

vi.mock('./storeResourceFlags', () => ({
  isStoreResourceFlagEnabled: mocks.isStoreResourceFlagEnabled
}));

import { resolveResourceAuthorization } from './resolveResourceAuthorization';

let project = { oid: 1n };
let instance = { oid: 2n, projectOid: 1n };
let consumerProfile = { oid: 3n, instanceOid: 2n, consumer: { oid: 4n } };
let resourceActor = {
  oid: 5n,
  id: 'rac_1',
  projectOid: 1n,
  consumerOid: 4n,
  consumerProfileOid: 3n
} as any;
let accessTags = [{ accessTagOid: 6n }];

let cliProfile = (d: { isInternal?: boolean; identifier?: string | null } = {}) => ({
  organizationActorOid: 10n,
  organizationMemberOid: null as bigint | null,
  surface: {
    isInternal: d.isInternal ?? true,
    internalSurfaceUniqueIdentifier: d.identifier === undefined ? 'cli' : d.identifier
  },
  consumer: {
    organizationActorOid: 7n,
    consumerOrganizationActors: [{ organizationActorOid: 8n }]
  }
});

let resolveConsumer = () =>
  resolveResourceAuthorization({
    project,
    instance,
    resourceActor,
    consumerProfile,
    accessTags
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isStoreResourceFlagEnabled.mockResolvedValue(true);
  mocks.findConsumerProfile.mockResolvedValue(cliProfile());
  mocks.findOrganizationMember.mockResolvedValue({ oid: 9n });
});

describe('resolveResourceAuthorization', () => {
  it('keeps members privileged without looking up the CLI surface', async () => {
    let result = await resolveResourceAuthorization({
      project,
      instance,
      resourceActor,
      member: { actor: { oid: 7n } },
      consumerProfile,
      accessTags
    });

    expect(result).toMatchObject({
      isMember: true,
      isCliMember: false,
      authorization: { type: 'privileged', resourceActor }
    });
    expect(mocks.isStoreResourceFlagEnabled).not.toHaveBeenCalled();
  });

  it('restricts CLI organization members while store-access-v2 is off', async () => {
    mocks.isStoreResourceFlagEnabled.mockResolvedValue(false);

    let result = await resolveConsumer();

    expect(result).toMatchObject({
      isCliMember: false,
      authorization: { type: 'restricted', resourceActor, accessTags }
    });
    expect(mocks.isStoreResourceFlagEnabled).toHaveBeenCalledWith({
      project,
      flag: 'store-access-v2'
    });
    expect(mocks.findConsumerProfile).not.toHaveBeenCalled();
  });

  it('makes active CLI organization members privileged when store-access-v2 is on', async () => {
    let result = await resolveConsumer();

    expect(result).toMatchObject({
      isMember: false,
      isCliMember: true,
      authorization: { type: 'privileged', resourceActor }
    });
    expect(mocks.findOrganizationMember).toHaveBeenCalledWith({
      where: {
        status: 'active',
        OR: [{ actorOid: { in: [10n, 7n, 8n] } }],
        organization: { projects: { some: { oid: project.oid } } }
      },
      select: { oid: true }
    });
  });

  it.each([
    ['a portal surface', { isInternal: false }],
    ['another internal surface', { identifier: 'slack' }],
    ['an internal surface without an identifier', { identifier: null }]
  ])('restricts organization members signed in through %s', async (_, surface) => {
    mocks.findConsumerProfile.mockResolvedValue(cliProfile(surface));

    let result = await resolveConsumer();

    expect(result.authorization.type).toBe('restricted');
    expect(mocks.findOrganizationMember).not.toHaveBeenCalled();
  });

  it('restricts CLI consumers that are not organization members', async () => {
    mocks.findOrganizationMember.mockResolvedValue(null);

    expect((await resolveConsumer()).authorization.type).toBe('restricted');
  });

  it('finds the member a CLI profile was created for', async () => {
    mocks.findConsumerProfile.mockResolvedValue({
      ...cliProfile(),
      organizationMemberOid: 11n,
      consumer: { organizationActorOid: null, consumerOrganizationActors: [] }
    });

    expect((await resolveConsumer()).authorization.type).toBe('privileged');
    expect(mocks.findOrganizationMember.mock.calls[0]![0].where.OR).toEqual([
      { oid: 11n },
      { actorOid: { in: [10n] } }
    ]);
  });

  it('stays privileged without a consumer profile', async () => {
    let result = await resolveResourceAuthorization({ project, instance });

    expect(result).toMatchObject({
      isMember: false,
      isCliMember: false,
      authorization: { type: 'privileged' }
    });
  });
});
