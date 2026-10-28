import { expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import type { ConsumerGroup, ConsumerSurface } from '@metorial/db';
import { skillService } from '@metorial/module-skill';
import { describe, expect, it } from 'vitest';
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

describe('module-consumer-entities consumer skills', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let authoringSurface = (
    fixture: OrganizationFixture,
    input: { allowConsumerSkillPublishing?: boolean } = {}
  ) =>
    createSurface(fixture, {
      allowConsumerSkillAuthoring: true,
      allowConsumerSkillPublishing: input.allowConsumerSkillPublishing ?? false
    });

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
      input: { name: uniqueId('consumer-skill') }
    });

  let canRead = async (fixture: OrganizationFixture, skillId: string, profile: Profile) => {
    try {
      await skillService.getSkillById({
        project: fixture.project,
        instance: fixture.instance,
        skillId,
        accessTags: (await consumerView(profile)).accessTags
      });
      return true;
    } catch (error: any) {
      if (error?.data?.code == 'not_found') return false;
      throw error;
    }
  };

  let canManage = async (skillId: string, profile: Profile) => {
    try {
      await consumerSkillService.assertConsumerCanManageSkillAccess({
        skill: await db.skill.findUniqueOrThrow({ where: { id: skillId } }),
        consumerProfile: profile
      });
      return true;
    } catch (error: any) {
      if (error?.data?.code == 'forbidden') return false;
      throw error;
    }
  };

  let grantedPolicies = async (skillId: string, profile: Profile) =>
    (
      await db.accessTagEntity.findMany({
        where: {
          accessTagOid: profile.personalConsumerGroup!.accessTagOid,
          skill: { id: skillId },
          accessTagPolicy: { systemIdentifier: { startsWith: 'skill_participant:' } }
        },
        include: { accessTagPolicy: true }
      })
    )
      .map(entity => entity.accessTagPolicy.systemIdentifier!.split(':').at(-1))
      .sort();

  let share = async (
    fixture: OrganizationFixture,
    skillId: string,
    permission: 'read' | 'write' | 'none',
    targets: { consumerProfileIds?: string[]; organizationMemberIds?: string[] },
    sharer?: { consumerProfile: Profile; consumerGroups: ConsumerGroup[] }
  ) =>
    await consumerSkillService.shareSkill({
      organization: fixture.organization,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skill: await skillService.getSkillById({
        project: fixture.project,
        instance: fixture.instance,
        skillId
      }),
      permission,
      targets,
      ...sharer
    });

  it('grants the author read, write and manage access and nobody else', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await authoringSurface(fixture);
    let author = await createProfile(fixture, surface);
    let peer = await createProfile(fixture, surface);

    let skill = await authorSkill(fixture, surface, author);

    expect(await grantedPolicies(skill.id, author)).toEqual([
      'skill_manage_access',
      'skill_read',
      'skill_write'
    ]);
    expect(await canRead(fixture, skill.id, author)).toBe(true);
    expect(await canManage(skill.id, author)).toBe(true);

    expect(await grantedPolicies(skill.id, peer)).toEqual([]);
    expect(await canRead(fixture, skill.id, peer)).toBe(false);
    expect(await canManage(skill.id, peer)).toBe(false);
  });

  it('shares a skill for reading, writing and revokes it again', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await authoringSurface(fixture);
    let author = await createProfile(fixture, surface);
    let peer = await createProfile(fixture, surface);
    let skill = await authorSkill(fixture, surface, author);
    let sharer = {
      consumerProfile: author,
      consumerGroups: [await getEveryoneGroup(surface)]
    };

    await share(fixture, skill.id, 'read', { consumerProfileIds: [peer.id] }, sharer);
    expect(await grantedPolicies(skill.id, peer)).toEqual(['skill_read']);
    expect(await canRead(fixture, skill.id, peer)).toBe(true);
    expect(await canManage(skill.id, peer)).toBe(false);

    await share(fixture, skill.id, 'write', { consumerProfileIds: [peer.id] }, sharer);
    expect(await grantedPolicies(skill.id, peer)).toEqual(['skill_read', 'skill_write']);

    await share(fixture, skill.id, 'none', { consumerProfileIds: [peer.id] }, sharer);
    expect(await grantedPolicies(skill.id, peer)).toEqual([]);
    expect(await canRead(fixture, skill.id, peer)).toBe(false);

    expect(await grantedPolicies(skill.id, author)).toEqual([
      'skill_manage_access',
      'skill_read',
      'skill_write'
    ]);
  });

  it('validates share targets and the sharing consumer', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await authoringSurface(fixture);
    let author = await createProfile(fixture, surface);
    let peer = await createProfile(fixture, surface);
    let grouped = await createProfile(fixture, surface);
    let siblingProfile = await createProfile(fixture, await createSurface(fixture));
    let foreignProfile = await createProfile(other, await createSurface(other));
    let group = await createGroup(fixture, surface);
    await addToGroups(fixture, grouped, [group.id]);
    let skill = await authorSkill(fixture, surface, author);
    let everyone = [await getEveryoneGroup(surface)];
    let asAuthor = { consumerProfile: author, consumerGroups: everyone };

    await expectServiceError(share(fixture, skill.id, 'read', {}, asAuthor), 'bad_request');
    await expectServiceError(
      share(
        fixture,
        skill.id,
        'read',
        { organizationMemberIds: [fixture.member.id] },
        asAuthor
      ),
      'forbidden'
    );
    await expectServiceError(
      share(fixture, skill.id, 'read', { consumerProfileIds: [author.id] }, asAuthor),
      'forbidden'
    );
    await expectServiceError(
      share(
        fixture,
        skill.id,
        'read',
        { consumerProfileIds: [grouped.id] },
        { consumerProfile: peer, consumerGroups: everyone }
      ),
      'forbidden'
    );

    for (let target of [siblingProfile, foreignProfile]) {
      await expectServiceError(
        share(fixture, skill.id, 'read', { consumerProfileIds: [target.id] }, asAuthor),
        'not_found'
      );
    }
    await expectServiceError(
      share(
        fixture,
        skill.id,
        'read',
        { consumerProfileIds: [peer.id] },
        {
          consumerProfile: author,
          consumerGroups: [group]
        }
      ),
      'not_found'
    );
    await share(
      fixture,
      skill.id,
      'read',
      { consumerProfileIds: [grouped.id] },
      {
        consumerProfile: author,
        consumerGroups: [group]
      }
    );
    expect(await canRead(fixture, skill.id, grouped)).toBe(true);

    await expectServiceError(
      share(fixture, skill.id, 'read', { consumerProfileIds: [author.id] }),
      'bad_request'
    );
    expect(await grantedPolicies(skill.id, author)).toEqual([
      'skill_manage_access',
      'skill_read',
      'skill_write'
    ]);

    for (let target of [peer, siblingProfile, foreignProfile]) {
      expect(await grantedPolicies(skill.id, target)).toEqual([]);
    }
  });

  it('publishes a skill to the shareable groups of a publishing surface', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let closedSurface = await authoringSurface(fixture);
    let closedAuthor = await createProfile(fixture, closedSurface);
    let closedSkill = await authorSkill(fixture, closedSurface, closedAuthor);
    await expectServiceError(
      consumerSkillService.publishConsumerSkill({
        organization: fixture.organization,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        consumerSurface: closedSurface,
        consumerProfile: closedAuthor,
        consumerGroups: [await getEveryoneGroup(closedSurface)],
        skillId: closedSkill.id
      }),
      'precondition_failed'
    );

    let surface = await authoringSurface(fixture, { allowConsumerSkillPublishing: true });
    let author = await createProfile(fixture, surface);
    let peer = await createProfile(fixture, surface);
    let skill = await authorSkill(fixture, surface, author);
    let everyone = await getEveryoneGroup(surface);
    let publish = (consumerProfile: Profile) =>
      consumerSkillService.publishConsumerSkill({
        organization: fixture.organization,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        consumerSurface: surface,
        consumerProfile,
        consumerGroups: [consumerProfile.personalConsumerGroup!, everyone],
        skillId: skill.id
      });

    await expectServiceError(publish(peer), 'forbidden');
    expect(await db.consumerAccess.count({ where: { skillOid: skill.oid } })).toBe(0);

    let published = await publish(author);
    expect(published.id).toBe(skill.id);

    let accesses = await db.consumerAccess.findMany({ where: { skillOid: skill.oid } });
    expect(accesses.map(access => access.consumerGroupOid)).toEqual([everyone.oid]);
    expect(await canRead(fixture, skill.id, peer)).toBe(true);
  });

  it('forks only skills the consumer can read', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await authoringSurface(fixture);
    let author = await createProfile(fixture, surface);
    let forker = await createProfile(fixture, surface);
    let skill = await authorSkill(fixture, surface, author);
    let fork = async (consumerSurface: ConsumerSurface) =>
      await consumerSkillService.forkConsumerSkill({
        organization: fixture.organization,
        instance: fixture.instance,
        project: fixture.project,
        auditScope: fixture.auditScope,
        consumerSurface,
        consumerProfile: forker,
        consumerGroups: (await consumerView(forker)).consumerGroups,
        parentSkillId: skill.id,
        input: { name: uniqueId('forked-skill') }
      });

    await expectServiceError(fork(surface), 'not_found');

    await share(
      fixture,
      skill.id,
      'read',
      { consumerProfileIds: [forker.id] },
      {
        consumerProfile: author,
        consumerGroups: [await getEveryoneGroup(surface)]
      }
    );
    await expectServiceError(
      fork(await createSurface(fixture, { allowConsumerSkillAuthoring: false })),
      'precondition_failed'
    );

    let forked = await fork(surface);
    expect(forked.id).not.toBe(skill.id);
    expect(await grantedPolicies(forked.id, forker)).toEqual([
      'skill_manage_access',
      'skill_read',
      'skill_write'
    ]);
    expect(await canRead(fixture, forked.id, author)).toBe(false);
    expect(await grantedPolicies(skill.id, forker)).toEqual(['skill_read']);
  });
});
