import {
  expectServiceError,
  firstPage,
  uniqueEmail,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID, type ConsumerGroup, type ConsumerSurface } from '@metorial/db';
import {
  consumerStoreWriteRoles,
  createResourceAuthorization,
  resolveResourceAuthorization,
  skillStoreResourceAccess,
  standaloneStoreResourceAccess,
  storeAccessGrantService,
  type ResourceAuthorization
} from '@metorial/module-access';
import { consumerAccessService } from '@metorial/module-consumer-access';
import {
  consumerProfileService,
  consumerSurfaceService
} from '@metorial/module-consumer-core';
import { resourceActorService } from '@metorial/module-resource-actor';
import { skillAccessGrantService, skillService } from '@metorial/module-skill';
import {
  storeAccessService,
  storeParticipantService,
  storeService
} from '@metorial/module-store';
import { afterEach, describe, expect, it } from 'vitest';
import { consumerSkillService } from '../src';
import {
  addToGroups,
  consumerView,
  createGroup,
  createProfile,
  createSurface,
  getEveryoneGroup
} from './_fixtures';

type Profile = Awaited<ReturnType<typeof createProfile>>;

let authoringSurface = (fixture: OrganizationFixture) =>
  createSurface(fixture, { allowConsumerSkillAuthoring: true });

let scopeOf = (fixture: OrganizationFixture) => ({
  project: fixture.project,
  instance: fixture.instance
});

let profileActor = async (fixture: OrganizationFixture, profile: Profile) =>
  await resourceActorService.ensureConsumerProfileActor({
    project: fixture.project,
    consumerProfile: profile
  });

let restricted = async (
  fixture: OrganizationFixture,
  profile: Profile
): Promise<ResourceAuthorization> =>
  createResourceAuthorization({
    restricted: true,
    resourceActor: await profileActor(fixture, profile),
    accessTags: (await consumerView(profile)).accessTags,
    project: fixture.project,
    instance: fixture.instance,
    consumerProfile: profile
  });

let isDenied = (error: any) => ['forbidden', 'not_found'].includes(error?.data?.code);

let allowed = async (run: () => Promise<unknown>) => {
  try {
    await run();
    return true;
  } catch (error) {
    if (isDenied(error)) return false;
    throw error;
  }
};

let authorSkill = async (
  fixture: OrganizationFixture,
  consumerSurface: ConsumerSurface,
  consumerProfile: Profile
) =>
  await consumerSkillService.createConsumerSkill({
    organization: fixture.organization,
    instance: fixture.instance,
    project: fixture.project,
    auditScope: fixture.auditScope,
    consumerSurface,
    consumerProfile,
    consumerGroups: [consumerProfile.personalConsumerGroup!],
    input: { name: uniqueId('store-resource-skill') }
  });

let organizationSkill = async (fixture: OrganizationFixture) =>
  await skillService.createSkill({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    input: {
      id: await ID.generateId('skill'),
      authorization: createResourceAuthorization({ restricted: false }),
      name: uniqueId('store-resource-org-skill'),
      description: 'Created by the e2e suite'
    }
  });

let getSkill = async (fixture: OrganizationFixture, skillId: string) =>
  await skillService.getSkillById({ ...scopeOf(fixture), skillId });

let skillAccess = async (fixture: OrganizationFixture, skillId: string, profile: Profile) => {
  let skill = await getSkill(fixture, skillId);
  let authorization = await restricted(fixture, profile);
  let store = await db.store.findUniqueOrThrow({ where: { oid: skill.storeOid! } });
  let levels: string[] = [];

  if (
    await allowed(() =>
      skillService.getSkillById({
        ...scopeOf(fixture),
        skillId,
        accessTags: (authorization as { accessTags: any }).accessTags
      })
    )
  ) {
    levels.push('skill_read');
  }
  if (
    await allowed(() =>
      skillService.assertSkillWriteAccess({ ...scopeOf(fixture), skill, authorization })
    )
  ) {
    levels.push('skill_write');
  }
  if (
    await allowed(async () =>
      consumerSkillService.assertConsumerCanManageSkillAccess({
        skill: await db.skill.findUniqueOrThrow({ where: { id: skillId } }),
        consumerProfile: profile
      })
    )
  ) {
    levels.push('skill_manage');
  }
  if (
    await allowed(() =>
      storeAccessService.assertStoreAccessForStore({
        ...scopeOf(fixture),
        authorization,
        store,
        requiredPermission: 'content_read'
      })
    )
  ) {
    levels.push('store_read');
  }
  if (
    await allowed(() =>
      storeAccessService.assertStoreAccessForStore({
        ...scopeOf(fixture),
        authorization,
        store,
        requiredPermission: 'content_write'
      })
    )
  ) {
    levels.push('store_write');
  }

  return levels;
};

let storeAccess = async (fixture: OrganizationFixture, storeId: string, profile: Profile) => {
  let store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
  let authorization = await restricted(fixture, profile);
  let levels: string[] = [];

  for (let [level, requiredPermission] of [
    ['read', 'content_read'],
    ['write', 'content_write']
  ] as const) {
    if (
      await allowed(() =>
        storeAccessService.assertStoreAccessForStore({
          ...scopeOf(fixture),
          authorization,
          store,
          requiredPermission
        })
      )
    ) {
      levels.push(level);
    }
  }

  return levels;
};

let share = async (
  fixture: OrganizationFixture,
  skillId: string,
  permission: 'read' | 'write' | 'none',
  target: Profile,
  sharer: { consumerProfile: Profile; consumerGroups: ConsumerGroup[] }
) =>
  await consumerSkillService.shareSkill({
    organization: fixture.organization,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    skill: await getSkill(fixture, skillId),
    permission,
    targets: { consumerProfileIds: [target.id] },
    ...sharer
  });

let participantRoles = async (
  fixture: OrganizationFixture,
  skillId: string,
  profile: Profile
) => {
  let skill = await getSkill(fixture, skillId);
  let actor = await profileActor(fixture, profile);
  let row = await db.storeParticipantActor.findUnique({
    where: {
      storeOid_resourceActorOid: { storeOid: skill.storeOid!, resourceActorOid: actor.oid }
    },
    include: { storeParticipant: true }
  });

  return row?.storeParticipant?.roles ?? [];
};

let fullAuthorAccess = [
  'skill_read',
  'skill_write',
  'skill_manage',
  'store_read',
  'store_write'
];

describe('consumer skill and store access', () => {
  let org = useOrganization();

  it('follows consumer skill shares for the skill and its store', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await authoringSurface(fixture);
    let author = await createProfile(fixture, surface);
    let peer = await createProfile(fixture, surface);
    let stranger = await createProfile(fixture, surface);
    let skill = await authorSkill(fixture, surface, author);
    let sharer = {
      consumerProfile: author,
      consumerGroups: [await getEveryoneGroup(surface)]
    };

    expect(await skillAccess(fixture, skill.id, author)).toEqual(fullAuthorAccess);
    expect(await skillAccess(fixture, skill.id, peer)).toEqual([]);

    await share(fixture, skill.id, 'read', peer, sharer);
    expect(await skillAccess(fixture, skill.id, peer)).toEqual(['skill_read', 'store_read']);
    expect(await participantRoles(fixture, skill.id, peer)).toEqual(['viewer']);

    await share(fixture, skill.id, 'write', peer, sharer);
    expect(await skillAccess(fixture, skill.id, peer)).toEqual([
      'skill_read',
      'skill_write',
      'store_read',
      'store_write'
    ]);
    expect(await participantRoles(fixture, skill.id, peer)).toEqual(['editor']);

    await share(fixture, skill.id, 'read', peer, sharer);
    expect(await participantRoles(fixture, skill.id, peer)).toEqual(['viewer']);

    await share(fixture, skill.id, 'none', peer, sharer);
    expect(await skillAccess(fixture, skill.id, peer)).toEqual([]);
    expect(await participantRoles(fixture, skill.id, peer)).toEqual([]);

    expect(await skillAccess(fixture, skill.id, author)).toEqual(fullAuthorAccess);
    expect(await skillAccess(fixture, skill.id, stranger)).toEqual([]);
  });

  it('follows group access to organization skills', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let group = await createGroup(fixture, surface);
    let member = await createProfile(fixture, surface);
    let outsider = await createProfile(fixture, surface);
    await addToGroups(fixture, member, [group.id]);
    let skill = await organizationSkill(fixture);

    expect(await skillAccess(fixture, skill.id, member)).toEqual([]);

    let access = await consumerAccessService.createConsumerAccess({
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: group,
      auditScope: fixture.auditScope,
      access: { type: 'skill', skill: await getSkill(fixture, skill.id) }
    });

    expect(await skillAccess(fixture, skill.id, member)).toEqual(['skill_read', 'store_read']);
    expect(await skillAccess(fixture, skill.id, outsider)).toEqual([]);

    await consumerAccessService.deleteConsumerAccess({
      organization: fixture.organization,
      consumerAccess: await consumerAccessService.getConsumerAccessById({
        consumerSurface: surface,
        consumerAccessId: access.id
      }),
      auditScope: fixture.auditScope
    });

    expect(await skillAccess(fixture, skill.id, member)).toEqual([]);
  });

  it('gives a consumer-created standalone store only to its creator and explicit grantees', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let creator = await createProfile(fixture, surface);
    let peer = await createProfile(fixture, surface);

    let store = await storeService.createStore({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      input: { name: uniqueId('consumer-store'), actor: await profileActor(fixture, creator) }
    });

    expect(await storeAccess(fixture, store.id, creator)).toEqual(['read', 'write']);
    expect(await storeAccess(fixture, store.id, peer)).toEqual([]);

    let peerActor = await profileActor(fixture, peer);
    await storeAccessService.ensureActorStorePermissions({
      store,
      actor: peerActor,
      permissions: ['content_read']
    });
    expect(await storeAccess(fixture, store.id, peer)).toEqual(['read']);

    await storeAccessService.ensureActorStorePermissions({
      store,
      actor: peerActor,
      permissions: [],
      overridePermissions: true
    });
    expect(await storeAccess(fixture, store.id, peer)).toEqual([]);
    expect(await storeAccess(fixture, store.id, creator)).toEqual(['read', 'write']);
  });

  it('lists skill access grants only for consumers that can manage the skill', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await authoringSurface(fixture);
    let author = await createProfile(fixture, surface);
    let peer = await createProfile(fixture, surface);
    let skill = await authorSkill(fixture, surface, author);
    await share(fixture, skill.id, 'read', peer, {
      consumerProfile: author,
      consumerGroups: [await getEveryoneGroup(surface)]
    });

    let list = async (authorization: ResourceAuthorization) =>
      (
        await skillAccessGrantService.listSkillAccessGrants({
          project: fixture.project,
          skill: await getSkill(fixture, skill.id),
          authorization
        })
      )
        .map(grant => [grant.accessTag.oid, grant.level])
        .sort();

    let expected = [
      [author.personalConsumerGroup!.accessTagOid, 'manage'],
      [peer.personalConsumerGroup!.accessTagOid, 'read']
    ].sort();

    expect(await list(createResourceAuthorization({ restricted: false }))).toEqual(expected);
    expect(await list(await restricted(fixture, author))).toEqual(expected);
    await expectServiceError(list(await restricted(fixture, peer)), 'forbidden');
  });

  it('keeps access another source still grants after a share is revoked', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await authoringSurface(fixture);
    let author = await createProfile(fixture, surface);
    let peer = await createProfile(fixture, surface);
    let group = await createGroup(fixture, surface);
    await addToGroups(fixture, peer, [group.id]);
    let skill = await authorSkill(fixture, surface, author);
    let sharer = {
      consumerProfile: author,
      consumerGroups: [await getEveryoneGroup(surface)]
    };

    let access = await consumerAccessService.createConsumerAccess({
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: group,
      auditScope: fixture.auditScope,
      access: { type: 'skill', skill: await getSkill(fixture, skill.id) }
    });
    expect(await skillAccess(fixture, skill.id, peer)).toEqual(['skill_read', 'store_read']);

    await share(fixture, skill.id, 'write', peer, sharer);
    expect(await skillAccess(fixture, skill.id, peer)).toEqual([
      'skill_read',
      'skill_write',
      'store_read',
      'store_write'
    ]);

    await share(fixture, skill.id, 'none', peer, sharer);
    expect(await skillAccess(fixture, skill.id, peer)).toEqual(['skill_read', 'store_read']);

    await consumerAccessService.deleteConsumerAccess({
      organization: fixture.organization,
      consumerAccess: await consumerAccessService.getConsumerAccessById({
        consumerSurface: surface,
        consumerAccessId: access.id
      }),
      auditScope: fixture.auditScope
    });
    expect(await skillAccess(fixture, skill.id, peer)).toEqual([]);
    expect(await skillAccess(fixture, skill.id, author)).toEqual(fullAuthorAccess);
  });

  it('reports participant permissions from the share grants', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await authoringSurface(fixture);
    let author = await createProfile(fixture, surface);
    let peer = await createProfile(fixture, surface);
    let skill = await getSkill(fixture, (await authorSkill(fixture, surface, author)).id);
    let sharer = {
      consumerProfile: author,
      consumerGroups: [await getEveryoneGroup(surface)]
    };

    let permissionsOf = async (profile: Profile) => {
      let actor = await profileActor(fixture, profile);
      let participants = await firstPage(
        await storeParticipantService.listStoreResourceParticipants({
          ...scopeOf(fixture),
          store: skill.store!
        })
      );
      let participant = participants.find(item =>
        item.actors.some(row => row.resourceActorOid == actor.oid)
      );
      if (!participant) return undefined;

      return (
        await storeParticipantService.findParticipantPermissions({
          store: skill.store!,
          participants: [participant]
        })
      ).get(participant.oid);
    };

    expect(await permissionsOf(author)).toEqual(['content_read', 'content_write']);
    expect(await permissionsOf(peer)).toBeUndefined();

    await share(fixture, skill.id, 'read', peer, sharer);
    expect(await permissionsOf(peer)).toEqual(['content_read']);

    await share(fixture, skill.id, 'write', peer, sharer);
    expect(await permissionsOf(peer)).toEqual(['content_read', 'content_write']);

    await share(fixture, skill.id, 'none', peer, sharer);
    expect(await permissionsOf(peer)).toEqual([]);
  });
});

describe('consumer store participants', () => {
  let org = useOrganization();

  let profilesOfOneConsumer = async (
    fixture: OrganizationFixture,
    email = uniqueEmail('store-participant')
  ) => {
    let authoringProfile = await createProfile(fixture, await authoringSurface(fixture), {
      email
    });
    let secondProfile = await createProfile(fixture, await createSurface(fixture), { email });
    expect(secondProfile.consumerOid).toBe(authoringProfile.consumerOid);

    return { authoringProfile, secondProfile };
  };

  let storeParticipants = async (fixture: OrganizationFixture, storeOid: bigint) =>
    await firstPage(
      await storeParticipantService.listStoreResourceParticipants({
        ...scopeOf(fixture),
        store: { oid: storeOid }
      })
    );

  it('dedupes participation of one consumer across surfaces', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { authoringProfile, secondProfile } = await profilesOfOneConsumer(fixture);
    let otherConsumer = await createProfile(fixture, await createSurface(fixture));

    let created = await authorSkill(
      fixture,
      await db.consumerSurface.findUniqueOrThrow({
        where: { oid: authoringProfile.surfaceOid }
      }),
      authoringProfile
    );
    let skill = await getSkill(fixture, created.id);

    for (let profile of [secondProfile, otherConsumer]) {
      await skillService.markSkillUse({
        ...scopeOf(fixture),
        skill,
        actor: await profileActor(fixture, profile)
      });
    }

    let participants = await storeParticipants(fixture, skill.storeOid!);
    expect(participants).toHaveLength(2);

    let shared = participants.find(item => item.consumerOid == authoringProfile.consumerOid);
    expect(shared).toMatchObject({ roles: ['creator', 'owner', 'viewer', 'user'] });
    expect(shared!.actors.map(row => row.resourceActor.consumerProfileOid).sort()).toEqual(
      [authoringProfile.oid, secondProfile.oid].sort()
    );

    let other = participants.find(item => item.consumerOid == otherConsumer.consumerOid);
    expect(other!.actors.map(row => row.resourceActor.consumerProfileOid)).toEqual([
      otherConsumer.oid
    ]);
  });

  it('folds the linked organization actor into the consumer participant', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { authoringProfile } = await profilesOfOneConsumer(fixture, fixture.user!.email);
    let previousOrganizationActorOid = authoringProfile.consumer.organizationActorOid;
    await db.consumer.update({
      where: { oid: authoringProfile.consumerOid },
      data: { organizationActorOid: fixture.actor.oid }
    });

    try {
      let created = await authorSkill(
        fixture,
        await db.consumerSurface.findUniqueOrThrow({
          where: { oid: authoringProfile.surfaceOid }
        }),
        authoringProfile
      );
      let skill = await getSkill(fixture, created.id);
      let organizationActor = await resourceActorService.ensureOrganizationActor({
        project: fixture.project,
        organizationActorOid: fixture.actor.oid
      });

      await skillService.markSkillUse({
        ...scopeOf(fixture),
        skill,
        actor: organizationActor
      });

      let participants = await storeParticipants(fixture, skill.storeOid!);
      expect(participants).toHaveLength(1);
      expect(participants[0]!.consumerOid).toBe(authoringProfile.consumerOid);
      expect(participants[0]!.actors.map(row => row.resourceActor.id).sort()).toEqual(
        [(await profileActor(fixture, authoringProfile)).id, organizationActor.id].sort()
      );
    } finally {
      await db.consumer.update({
        where: { oid: authoringProfile.consumerOid },
        data: { organizationActorOid: previousOrganizationActorOid }
      });
    }
  });
});

describe('store participants of members with a portal consumer', () => {
  let org = useOrganization();
  let linkedConsumerOids: bigint[] = [];

  afterEach(async () => {
    await db.consumer.updateMany({
      where: { oid: { in: linkedConsumerOids } },
      data: { userOid: null }
    });
    linkedConsumerOids = [];
  });

  let setup = async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let author = await createProfile(fixture, await authoringSurface(fixture));
    let skill = await getSkill(
      fixture,
      (
        await authorSkill(
          fixture,
          await db.consumerSurface.findUniqueOrThrow({ where: { oid: author.surfaceOid } }),
          author
        )
      ).id
    );
    let memberActor = await resourceActorService.ensureOrganizationActor({
      project: fixture.project,
      organizationActorOid: fixture.actor.oid
    });
    let portalProfile = await createProfile(fixture, await createSurface(fixture), {
      email: uniqueEmail('member-portal-consumer')
    });

    let use = async (actor: typeof memberActor) =>
      await skillService.markSkillUse({ ...scopeOf(fixture), skill, actor });
    let linkToUser = async () => {
      linkedConsumerOids.push(portalProfile.consumerOid);
      await db.consumer.update({
        where: { oid: portalProfile.consumerOid },
        data: { userOid: fixture.user!.oid }
      });
    };
    let participantsOfUser = async () =>
      (
        await firstPage(
          await storeParticipantService.listStoreResourceParticipants({
            ...scopeOf(fixture),
            store: { oid: skill.storeOid! }
          })
        )
      ).filter(participant => participant.consumerOid != author.consumerOid);

    return {
      memberActor,
      portalActor: await profileActor(fixture, portalProfile),
      portalProfile,
      use,
      linkToUser,
      participantsOfUser
    };
  };

  it('records a member under the portal consumer of the same user', async () => {
    let { memberActor, portalActor, portalProfile, use, linkToUser, participantsOfUser } =
      await setup();

    await linkToUser();
    await use(memberActor);
    await use(portalActor);

    let participants = await participantsOfUser();
    expect(participants).toHaveLength(1);
    expect(participants[0]!.consumerOid).toBe(portalProfile.consumerOid);
    expect(participants[0]!.actors.map(row => row.resourceActor.id).sort()).toEqual(
      [memberActor.id, portalActor.id].sort()
    );
  });

  it('folds an earlier member participant into the consumer once it is linked', async () => {
    let { memberActor, portalActor, portalProfile, use, linkToUser, participantsOfUser } =
      await setup();

    await use(memberActor);
    expect(await participantsOfUser()).toHaveLength(1);

    await linkToUser();
    await use(portalActor);

    let participants = await participantsOfUser();
    expect(participants).toHaveLength(1);
    expect(participants[0]!.consumerOid).toBe(portalProfile.consumerOid);
    expect(participants[0]!.actors.map(row => row.resourceActor.id).sort()).toEqual(
      [memberActor.id, portalActor.id].sort()
    );
  });

  it('keeps a portal consumer of another user apart from the member', async () => {
    let { memberActor, portalActor, use, participantsOfUser } = await setup();

    await use(memberActor);
    await use(portalActor);

    expect(await participantsOfUser()).toHaveLength(2);
  });
});

describe('CLI organization member authorization', () => {
  let org = useOrganization();
  let member = useMember(org);

  let cliProfile = async (fixture: OrganizationFixture) => {
    let surface = await consumerSurfaceService.ensureInternalConsumerSurface({
      instance: fixture.instance,
      identifier: 'cli',
      name: 'CLI',
      type: 'organization_members'
    });
    let created = await consumerProfileService.ensureConsumerProfile({
      surface,
      email: fixture.user!.email,
      name: 'E2E CLI Consumer',
      member: fixture.member,
      auditScope: fixture.auditScope
    });

    return await db.consumerProfile.findUniqueOrThrow({
      where: { oid: created.oid },
      include: { consumer: true, personalConsumerGroup: true }
    });
  };

  let resolve = async (fixture: OrganizationFixture, profile: Profile) =>
    await resolveResourceAuthorization({
      ...scopeOf(fixture),
      resourceActor: await profileActor(fixture, profile),
      consumerProfile: profile,
      accessTags: (await consumerView(profile)).accessTags
    });

  it('privileges CLI profiles of organization members', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let profile = await cliProfile(fixture);
    expect(profile.organizationMemberOid).toBe(fixture.member.oid);

    let result = await resolve(fixture, profile);
    expect(result.isCliMember).toBe(true);
    expect(result.authorization.type).toBe('privileged');
  });

  it('restricts CLI profiles once the member left the organization', async () => {
    let fixture = await loadOrganizationFixture({ ...org.ids, userId: member.user.id });
    let profile = await cliProfile(fixture);
    await db.organizationMember.update({
      where: { oid: fixture.member.oid },
      data: { status: 'deleted' }
    });

    try {
      let result = await resolve(fixture, profile);
      expect(result.isCliMember).toBe(false);
      expect(result.authorization.type).toBe('restricted');
    } finally {
      await db.organizationMember.update({
        where: { oid: fixture.member.oid },
        data: { status: 'active' }
      });
    }
  });

  it('restricts organization members signed in through a portal', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let profile = await createProfile(fixture, await createSurface(fixture), {
      email: fixture.user!.email
    });

    let result = await resolve(fixture, profile);
    expect(result.isCliMember).toBe(false);
    expect(result.authorization.type).toBe('restricted');
  });
});

let linkToMember = async (profile: Profile, member: { oid: bigint }) => {
  await db.consumer.update({
    where: { oid: profile.consumerOid },
    data: { organizationMemberOid: member.oid }
  });

  return await db.consumerProfile.findUniqueOrThrow({
    where: { oid: profile.oid },
    include: { consumer: true, personalConsumerGroup: true }
  });
};

let setFullSkillAccess = async (fixture: OrganizationFixture, enabled: boolean) => {
  fixture.project = await db.project.update({
    where: { oid: fixture.project.oid },
    data: { allowOrganizationMemberFullSkillAccess: enabled }
  });
};

let readAccess = ['skill_read', 'store_read'];

describe('organization member consumers', () => {
  let org = useOrganization();
  let leaver = useMember(org);

  let setup = async (fixture: OrganizationFixture) => {
    let surface = await authoringSurface(fixture);
    let author = await createProfile(fixture, surface);
    let sharer = {
      consumerProfile: author,
      consumerGroups: [await getEveryoneGroup(surface)]
    };
    let skill = await authorSkill(fixture, surface, author);
    let hiddenSkill = await authorSkill(fixture, surface, author);
    let memberProfile = await linkToMember(
      await createProfile(fixture, surface),
      fixture.member
    );
    let peer = await createProfile(fixture, surface);
    await share(fixture, skill.id, 'read', memberProfile, sharer);
    await share(fixture, skill.id, 'read', peer, sharer);

    return { surface, author, sharer, skill, hiddenSkill, memberProfile, peer };
  };

  it('gives linked members full access to skills they can see', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { skill, hiddenSkill, memberProfile, peer } = await setup(fixture);

    expect(await skillAccess(fixture, skill.id, memberProfile)).toEqual(fullAuthorAccess);
    expect(await skillAccess(fixture, hiddenSkill.id, memberProfile)).toEqual([]);
    expect(await skillAccess(fixture, skill.id, peer)).toEqual(readAccess);

    let permissions = await storeService.getStorePermissions({
      ...scopeOf(fixture),
      store: await db.store.findUniqueOrThrow({ where: { oid: skill.storeOid! } }),
      authorization: await restricted(fixture, memberProfile)
    });
    expect(permissions.canManageAccess).toBe(true);
    expect(permissions.permissions.includes('content_write')).toBe(true);
  });

  it('keeps linked members on their grants when the project setting is off', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { skill, memberProfile } = await setup(fixture);
    await setFullSkillAccess(fixture, false);

    try {
      expect(await skillAccess(fixture, skill.id, memberProfile)).toEqual(readAccess);
    } finally {
      await setFullSkillAccess(fixture, true);
    }
  });

  it('keeps consumers on their grants once their member left the organization', async () => {
    let fixture = await loadOrganizationFixture({ ...org.ids, userId: leaver.user.id });
    let { skill, memberProfile } = await setup(fixture);
    await db.organizationMember.update({
      where: { oid: fixture.member.oid },
      data: { status: 'deleted' }
    });

    try {
      expect(await skillAccess(fixture, skill.id, memberProfile)).toEqual(readAccess);
    } finally {
      await db.organizationMember.update({
        where: { oid: fixture.member.oid },
        data: { status: 'active' }
      });
    }
  });

  it('lets linked members share skills they can see', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { surface, skill, memberProfile, peer } = await setup(fixture);
    await share(fixture, skill.id, 'write', peer, {
      consumerProfile: memberProfile,
      consumerGroups: [await getEveryoneGroup(surface)]
    });

    expect(await skillAccess(fixture, skill.id, peer)).toEqual([
      'skill_read',
      'skill_write',
      'store_read',
      'store_write'
    ]);
  });

  it('records linked members as editors and flags them as organization member participants', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { skill, memberProfile, peer } = await setup(fixture);

    await skillService.updateSkill({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      skill: await getSkill(fixture, skill.id),
      authorization: await restricted(fixture, memberProfile),
      input: { description: 'Edited by an organization member' }
    });
    expect(await participantRoles(fixture, skill.id, memberProfile)).toContain('editor');

    let participants = await firstPage(
      await storeParticipantService.listStoreResourceParticipants({
        ...scopeOf(fixture),
        store: { oid: skill.storeOid! }
      })
    );
    let participantOf = async (profile: Profile) => {
      let actor = await profileActor(fixture, profile);
      return participants.find(participant =>
        participant.actors.some(row => row.resourceActorOid == actor.oid)
      )!;
    };
    let flagged = await storeParticipantService.findOrganizationMemberParticipantOids({
      project: fixture.project,
      participants
    });

    expect(flagged.has((await participantOf(memberProfile)).oid)).toBe(true);
    expect(flagged.has((await participantOf(peer)).oid)).toBe(false);

    await setFullSkillAccess(fixture, false);
    try {
      let disabled = await storeParticipantService.findOrganizationMemberParticipantOids({
        project: fixture.project,
        participants
      });
      expect(disabled.size).toBe(0);
    } finally {
      await setFullSkillAccess(fixture, true);
    }
  });
});
