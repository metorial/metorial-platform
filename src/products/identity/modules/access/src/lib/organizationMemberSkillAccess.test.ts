import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findConsumerProfile: vi.fn(),
  findOrganizationMember: vi.fn(),
  findProject: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    project: { findUnique: mocks.findProject },
    consumerProfile: { findUnique: mocks.findConsumerProfile },
    organizationMember: { findFirst: mocks.findOrganizationMember }
  }
}));

import {
  getEffectiveSkillAccessLevel,
  hasOrganizationMemberSkillAccess
} from './organizationMemberSkillAccess';

let project = { oid: 1n, allowOrganizationMemberFullSkillAccess: true };

let restricted = () =>
  ({
    type: 'restricted',
    resourceActor: { oid: 5n, projectOid: 1n, consumerOid: 4n, consumerProfileOid: 3n },
    accessTags: [{ accessTagOid: 6n }]
  }) as any;

let linkedProfile = {
  organizationActorOid: 10n,
  organizationMemberOid: 11n,
  surface: { isInternal: false, internalSurfaceUniqueIdentifier: null },
  consumer: {
    organizationActorOid: null,
    organizationMemberOid: null,
    consumerOrganizationActors: []
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findConsumerProfile.mockResolvedValue(linkedProfile);
  mocks.findOrganizationMember.mockResolvedValue({ oid: 9n });
});

describe('hasOrganizationMemberSkillAccess', () => {
  it('elevates consumers linked to an active organization member', async () => {
    expect(
      await hasOrganizationMemberSkillAccess({ project, authorization: restricted() })
    ).toBe(true);
    expect(mocks.findOrganizationMember).toHaveBeenCalledWith({
      where: {
        status: 'active',
        OR: [{ oid: { in: [11n] } }, { actorOid: { in: [10n] } }],
        organization: { projects: { some: { oid: project.oid } } }
      },
      select: { oid: true }
    });
  });

  it('finds the member through the consumer of a portal profile', async () => {
    mocks.findConsumerProfile.mockResolvedValue({
      ...linkedProfile,
      organizationMemberOid: null,
      consumer: {
        organizationActorOid: null,
        organizationMemberOid: 12n,
        consumerOrganizationActors: [{ organizationActorOid: 13n }]
      }
    });

    expect(await hasOrganizationMemberSkillAccess({ project, consumerProfileOid: 3n })).toBe(
      true
    );
    expect(mocks.findOrganizationMember.mock.calls[0]![0].where.OR).toEqual([
      { oid: { in: [12n] } },
      { actorOid: { in: [10n, 13n] } }
    ]);
  });

  it('never elevates when the project setting is off', async () => {
    expect(
      await hasOrganizationMemberSkillAccess({
        project: { ...project, allowOrganizationMemberFullSkillAccess: false },
        consumerProfileOid: 3n
      })
    ).toBe(false);
    expect(mocks.findConsumerProfile).not.toHaveBeenCalled();
  });

  it('loads the project setting when the caller only provides the project oid', async () => {
    mocks.findProject.mockResolvedValueOnce({ allowOrganizationMemberFullSkillAccess: true });
    expect(
      await hasOrganizationMemberSkillAccess({ project: { oid: 1n }, consumerProfileOid: 3n })
    ).toBe(true);

    mocks.findProject.mockResolvedValueOnce({ allowOrganizationMemberFullSkillAccess: false });
    expect(
      await hasOrganizationMemberSkillAccess({ project: { oid: 1n }, consumerProfileOid: 3n })
    ).toBe(false);
    expect(mocks.findProject).toHaveBeenCalledWith({
      where: { oid: 1n },
      select: { allowOrganizationMemberFullSkillAccess: true }
    });
  });

  it('does not elevate consumers without an active organization member', async () => {
    mocks.findOrganizationMember.mockResolvedValue(null);

    expect(await hasOrganizationMemberSkillAccess({ project, consumerProfileOid: 3n })).toBe(
      false
    );
  });

  it('does not elevate unknown consumer profiles', async () => {
    mocks.findConsumerProfile.mockResolvedValue(null);

    expect(await hasOrganizationMemberSkillAccess({ project, consumerProfileOid: 3n })).toBe(
      false
    );
    expect(mocks.findOrganizationMember).not.toHaveBeenCalled();
  });

  it('does not elevate restricted actors without a consumer profile', async () => {
    let authorization = restricted();
    authorization.resourceActor.consumerProfileOid = null;

    expect(await hasOrganizationMemberSkillAccess({ project, authorization })).toBe(false);
    expect(mocks.findConsumerProfile).not.toHaveBeenCalled();
  });

  it('resolves an authorization only once', async () => {
    let authorization = restricted();

    await hasOrganizationMemberSkillAccess({ project, authorization });
    await hasOrganizationMemberSkillAccess({ project, authorization });

    expect(mocks.findOrganizationMember).toHaveBeenCalledTimes(1);
  });

  it('never elevates privileged authorizations', async () => {
    expect(
      await hasOrganizationMemberSkillAccess({
        project,
        authorization: { type: 'privileged' }
      })
    ).toBe(false);
    expect(mocks.findConsumerProfile).not.toHaveBeenCalled();
  });
});

describe('getEffectiveSkillAccessLevel', () => {
  it('lowers write and manage to read for elevated consumers', async () => {
    let authorization = restricted();

    expect(
      await getEffectiveSkillAccessLevel({ project, authorization, level: 'write' })
    ).toBe('read');
    expect(
      await getEffectiveSkillAccessLevel({ project, authorization, level: 'manage' })
    ).toBe('read');
  });

  it('keeps the requested level for other consumers', async () => {
    mocks.findOrganizationMember.mockResolvedValue(null);

    expect(
      await getEffectiveSkillAccessLevel({
        project,
        authorization: restricted(),
        level: 'write'
      })
    ).toBe('write');
  });

  it('does not look anything up for read checks', async () => {
    expect(
      await getEffectiveSkillAccessLevel({
        project,
        authorization: restricted(),
        level: 'read'
      })
    ).toBe('read');
    expect(mocks.findConsumerProfile).not.toHaveBeenCalled();
  });
});
