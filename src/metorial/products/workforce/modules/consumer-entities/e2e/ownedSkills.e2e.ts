import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID, type ConsumerSurface, type ResourceActor } from '@metorial/db';
import { createResourceAuthorization } from '@metorial/module-access';
import { resourceActorService } from '@metorial/module-resource-actor';
import { skillService } from '@metorial/module-skill';
import { describe, expect, it } from 'vitest';
import { consumerSkillService } from '../src';
import { consumerView, createProfile, createSurface } from './_fixtures';

type Profile = Awaited<ReturnType<typeof createProfile>>;

describe('module-consumer-entities owned skills', () => {
  let org = useOrganization();

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
      input: { name: uniqueId('owned-skill') }
    });

  let createMemberSkill = async (fixture: OrganizationFixture, actor?: ResourceActor) =>
    await skillService.createSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: {
        id: await ID.generateId('skill'),
        authorization: createResourceAuthorization({
          restricted: false,
          resourceActor: actor
        }),
        name: uniqueId('owned-skill')
      }
    });

  let listOwnedIds = async (
    fixture: OrganizationFixture,
    actor: ResourceActor,
    opts: { profile?: Profile } = {}
  ) =>
    (
      await firstPage(
        await skillService.listSkills({
          project: fixture.project,
          instance: fixture.instance,
          ownedByActor: actor,
          accessTags: opts.profile ? (await consumerView(opts.profile)).accessTags : undefined
        })
      )
    ).map(skill => skill.id);

  it('includes skills created through the same user as a member or as a consumer', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture, { allowConsumerSkillAuthoring: true });
    let memberActor = await resourceActorService.ensureOrganizationActor({
      project: fixture.project,
      organizationActorOid: fixture.actor.oid
    });

    let linkedProfile = await createProfile(fixture, surface);
    await db.consumer.update({
      where: { oid: linkedProfile.consumerOid },
      data: { userOid: fixture.user.oid }
    });
    let otherProfile = await createProfile(fixture, surface);

    let memberSkill = await createMemberSkill(fixture, memberActor);
    let consumerSkill = await authorSkill(fixture, surface, linkedProfile);
    let otherSkill = await authorSkill(fixture, surface, otherProfile);
    let unownedSkill = await createMemberSkill(fixture);

    let ids = await listOwnedIds(fixture, memberActor);

    expect(ids).toEqual(expect.arrayContaining([memberSkill.id, consumerSkill.id]));
    expect(ids).not.toContain(otherSkill.id);
    expect(ids).not.toContain(unownedSkill.id);
  });

  it('only returns owned skills the consumer can still read', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture, { allowConsumerSkillAuthoring: true });
    let memberActor = await resourceActorService.ensureOrganizationActor({
      project: fixture.project,
      organizationActorOid: fixture.actor.oid
    });

    let profile = await createProfile(fixture, surface);
    await db.consumer.update({
      where: { oid: profile.consumerOid },
      data: { userOid: fixture.user.oid }
    });
    let consumerActor = await resourceActorService.ensureConsumerProfileActor({
      project: fixture.project,
      consumerProfile: profile
    });

    let privateMemberSkill = await createMemberSkill(fixture, memberActor);
    let consumerSkill = await authorSkill(fixture, surface, profile);

    let ids = await listOwnedIds(fixture, consumerActor, { profile });

    expect(ids).toContain(consumerSkill.id);
    expect(ids).not.toContain(privateMemberSkill.id);
  });

  it('includes skills the caller was made an owner of', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture, { allowConsumerSkillAuthoring: true });
    let author = await createProfile(fixture, surface);
    let owner = await createProfile(fixture, surface);
    let ownerActor = await resourceActorService.ensureConsumerProfileActor({
      project: fixture.project,
      consumerProfile: owner
    });

    let skill = await authorSkill(fixture, surface, author);
    expect(await listOwnedIds(fixture, ownerActor)).not.toContain(skill.id);

    await consumerSkillService.grantConsumerSkillOwnership({
      consumerProfileOid: owner.oid,
      skill: await db.skill.findUniqueOrThrow({ where: { id: skill.id } })
    });

    expect(await listOwnedIds(fixture, ownerActor)).toContain(skill.id);
  });
});
