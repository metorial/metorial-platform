import { expectServiceError, uniqueId, useMember, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import type { ConsumerGroup } from '@metorial/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { resourceActorService } from '@metorial/module-resource-actor';
import { createSkillMcpCatalog } from '@metorial-subspace/module-connection';
import { skillService } from '@metorial/module-skill';
import { describe, expect, it } from 'vitest';
import {
  consumerSkillService,
  createConsumerSkillSource,
  createSkillEditingTools,
  skillMcpAvailabilityService
} from '../src';
import {
  consumerView,
  createProfile,
  createSurface,
  getEveryoneGroup,
  useStoreResourceFlags
} from './_fixtures';

type Profile = Awaited<ReturnType<typeof createProfile>>;

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

describe.each([
  ['legacy', false],
  ['v2', true]
])('skills over MCP with organization member access (%s)', (_, enabled) => {
  let org = useOrganization();
  let leaver = useMember(org);
  useStoreResourceFlags(enabled);

  let setup = async (fixture: OrganizationFixture) => {
    let surface = await createSurface(fixture, { allowConsumerSkillAuthoring: true });
    let author = await createProfile(fixture, surface);
    let everyone: ConsumerGroup = await getEveryoneGroup(surface);

    let authorSkill = async (name: string) =>
      await consumerSkillService.createConsumerSkill({
        organization: fixture.organization,
        instance: fixture.instance,
        project: fixture.project,
        auditScope: fixture.auditScope,
        consumerSurface: surface,
        consumerProfile: author,
        consumerGroups: [author.personalConsumerGroup!],
        input: { name: uniqueId(name), description: `${name} description` }
      });

    let skill = await authorSkill('Shared');
    let hidden = await authorSkill('Hidden');
    let member = await linkToMember(await createProfile(fixture, surface), fixture.member);
    let peer = await createProfile(fixture, surface);

    for (let target of [member, peer]) {
      await consumerSkillService.shareSkill({
        organization: fixture.organization,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill: await skillService.getSkillById({
          project: fixture.project,
          instance: fixture.instance,
          skillId: skill.id
        }),
        permission: 'read',
        targets: { consumerProfileIds: [target.id] },
        consumerProfile: author,
        consumerGroups: [everyone]
      });
    }

    return { skill, hidden, member, peer };
  };

  let catalogFor = async (fixture: OrganizationFixture, profile: Profile) => {
    let source = await createConsumerSkillSource({
      instance: fixture.instance,
      consumerProfile: profile,
      context: fixture.context
    });
    if (!source) throw new Error('Expected a skill catalog');

    return createSkillMcpCatalog(source);
  };

  let editingTools = async (fixture: OrganizationFixture, profile: Profile) => {
    let tools = await createSkillEditingTools({
      instance: fixture.instance,
      consumerProfile: profile,
      context: fixture.context
    });
    if (!tools) throw new Error('Expected skill editing tools');

    return tools;
  };

  let write = async (
    fixture: OrganizationFixture,
    profile: Profile,
    skillId: string,
    content: string
  ) =>
    (await editingTools(fixture, profile)).call('metorial_skill_write_file', {
      skill: skillId,
      path: '/notes.md',
      content
    });

  it('serves linked members and peers only the skills they were granted', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { skill, hidden, member, peer } = await setup(fixture);

    for (let profile of [member, peer]) {
      let catalog = await catalogFor(fixture, profile);
      let { skills } = await catalog.listSkills({});

      expect(skills.map(entry => entry.frontmatter.description)).toEqual([
        'Shared description'
      ]);

      let [entry] = skills;
      expect(await catalog.getSkill({ uri: entry!.uri })).toEqual(entry);
      expect(await catalog.readResource({ uri: entry!.uri })).not.toBeNull();
    }

    let tools = await editingTools(fixture, member);
    let listed = await tools.call('metorial_skill_list', {});
    expect(listed.skills.map((entry: { id: string }) => entry.id)).toEqual([skill.id]);

    await expectServiceError(
      tools.call('metorial_skill_get', { skill: hidden.id }),
      'not_found'
    );
  });

  it('reports MCP availability only to consumers that can read the skill', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { skill, hidden, member, peer } = await setup(fixture);

    let availability = async (profile: Profile, skillId: string) =>
      await skillMcpAvailabilityService.getSkillMcpAvailability({
        project: fixture.project,
        instance: fixture.instance,
        skill: await skillService.getSkillById({
          project: fixture.project,
          instance: fixture.instance,
          skillId
        }),
        authorization: createResourceAuthorization({
          restricted: true,
          resourceActor: await resourceActorService.ensureConsumerProfileActor({
            project: fixture.project,
            consumerProfile: profile
          }),
          accessTags: (await consumerView(profile)).accessTags,
          project: fixture.project,
          instance: fixture.instance,
          consumerProfile: profile
        })
      });

    for (let profile of [member, peer]) {
      expect(await availability(profile, skill.id)).toMatchObject({
        available: true,
        exceededLimits: [],
        fileCount: 1
      });
      await expectServiceError(availability(profile, hidden.id), 'forbidden');
    }
  });

  it(`${enabled ? 'lets' : 'does not let'} linked members edit the skills they can read`, async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { skill, member, peer } = await setup(fixture);

    await expectServiceError(write(fixture, peer, skill.id, 'peer\n'), 'forbidden');

    let memberWrite = write(fixture, member, skill.id, 'member\n');
    if (!enabled) {
      await expectServiceError(memberWrite, 'forbidden');
      return;
    }

    expect(await memberWrite).toMatchObject({ type: 'put', path: '/notes.md' });

    let catalog = await catalogFor(fixture, peer);
    let [entry] = (await catalog.listSkills({})).skills;
    let notes = entry!.resources.find(resource => resource.uri.endsWith('/notes.md'));
    expect(notes).toBeDefined();
    expect(await catalog.readResource({ uri: notes!.uri })).toMatchObject({
      text: 'member\n'
    });
  });

  it('keeps linked members on their grants when the project setting is off', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { skill, member } = await setup(fixture);
    await setFullSkillAccess(fixture, false);

    try {
      await expectServiceError(write(fixture, member, skill.id, 'member\n'), 'forbidden');
      expect((await (await catalogFor(fixture, member)).listSkills({})).skills).toHaveLength(
        1
      );
    } finally {
      await setFullSkillAccess(fixture, true);
    }
  });

  it('keeps consumers on their grants once their member left the organization', async () => {
    let fixture = await loadOrganizationFixture({ ...org.ids, userId: leaver.user.id });
    let { skill, member } = await setup(fixture);
    await db.organizationMember.update({
      where: { oid: fixture.member.oid },
      data: { status: 'deleted' }
    });

    try {
      await expectServiceError(write(fixture, member, skill.id, 'member\n'), 'forbidden');
      expect((await (await catalogFor(fixture, member)).listSkills({})).skills).toHaveLength(
        1
      );
    } finally {
      await db.organizationMember.update({
        where: { oid: fixture.member.oid },
        data: { status: 'active' }
      });
    }
  });
});
