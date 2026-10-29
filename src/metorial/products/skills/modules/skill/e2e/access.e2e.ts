import {
  expectServiceError,
  firstPage,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { consumerSkillReadRoles, consumerSkillWriteRoles } from '@metorial/module-access';
import { resourceActorService } from '@metorial/module-resource-actor';
import { describe, expect, it } from 'vitest';
import { type SkillRecord, skillParticipantService, skillService } from '../src';
import {
  consumerAuthorization,
  createConsumerAccessTag,
  createSkill,
  grantAccess,
  memberAuthorization,
  organizationResourceActor,
  privileged,
  useStoreResourceFlags
} from './_fixtures';

let consumerRead = async (
  fixture: OrganizationFixture,
  skillId: string,
  accessTags: { accessTagOid: bigint }[],
  opts: { allowDeleted?: boolean } = {}
) =>
  await skillService.getSkillById({
    project: fixture.project,
    instance: fixture.instance,
    skillId,
    accessTags,
    allowDeleted: opts.allowDeleted
  });

let listParticipants = async (
  fixture: OrganizationFixture,
  skill: SkillRecord,
  actorIds?: string[]
) =>
  await firstPage(
    await skillParticipantService.listSkillParticipants({
      project: fixture.project,
      instance: fixture.instance,
      skillId: skill.id,
      actorIds
    })
  );

describe.each([
  ['legacy', false],
  ['v2', true]
])('module-skill access (%s)', (_, enabled) => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);
  useStoreResourceFlags(enabled);

  let memberFixture = async () =>
    await loadOrganizationFixture({ ...org.ids, userId: member.user.id });

  it('lets consumers read only active skills granted to their access tag', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let { accessTag, accessTags } = await createConsumerAccessTag(fixture);

    let granted = await createSkill(fixture);
    let ungranted = await createSkill(fixture);
    let archived = await createSkill(fixture);
    await grantAccess(fixture, { accessTag, roles: consumerSkillReadRoles, skill: granted });
    await grantAccess(fixture, { accessTag, roles: consumerSkillReadRoles, skill: archived });
    await skillService.archiveSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skill: archived,
      authorization: privileged
    });

    expect((await consumerRead(fixture, granted.id, accessTags)).id).toBe(granted.id);
    await expectServiceError(consumerRead(fixture, ungranted.id, accessTags), 'not_found');
    await expectServiceError(
      consumerRead(fixture, archived.id, accessTags, { allowDeleted: true }),
      'not_found'
    );

    let listed = await firstPage(
      await skillService.listSkills({
        project: fixture.project,
        instance: fixture.instance,
        ids: [granted.id, ungranted.id, archived.id],
        statuses: ['active', 'archived'],
        accessTags
      })
    );
    expect(listed.map(item => item.id)).toEqual([granted.id]);

    await expectServiceError(consumerRead(other, granted.id, accessTags), 'not_found');
  });

  it('scopes a grant to the access tag it was made for', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let first = await createConsumerAccessTag(fixture);
    let second = await createConsumerAccessTag(fixture);
    let skill = await createSkill(fixture);
    await grantAccess(fixture, {
      accessTag: first.accessTag,
      roles: consumerSkillReadRoles,
      skill
    });

    expect((await consumerRead(fixture, skill.id, first.accessTags)).id).toBe(skill.id);
    await expectServiceError(consumerRead(fixture, skill.id, second.accessTags), 'not_found');
  });

  it('requires a write grant before a consumer may edit or archive a skill', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { accessTag, accessTags } = await createConsumerAccessTag(fixture);
    let skill = await createSkill(fixture);
    await grantAccess(fixture, { accessTag, roles: consumerSkillReadRoles, skill });
    let authorization = await consumerAuthorization(fixture, accessTags);

    let denied = await expectServiceError(
      skillService.updateSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill,
        authorization,
        input: { description: 'Consumer edit' }
      }),
      'forbidden'
    );
    expect(denied.message).toMatch(/write access/);

    await expectServiceError(
      skillService.archiveSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill,
        authorization
      }),
      'forbidden'
    );

    let unchanged = await db.skill.findUniqueOrThrow({ where: { id: skill.id } });
    expect(unchanged).toMatchObject({ description: skill.description, status: 'active' });

    await grantAccess(fixture, { accessTag, roles: consumerSkillWriteRoles, skill });

    let updated = await skillService.updateSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skill,
      authorization,
      input: { description: 'Consumer edit' }
    });
    expect(updated.description).toBe('Consumer edit');
  });

  it('does not let a consumer write grant on one skill reach another skill', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { accessTag, accessTags } = await createConsumerAccessTag(fixture);
    let writable = await createSkill(fixture);
    let readable = await createSkill(fixture);
    await grantAccess(fixture, { accessTag, roles: consumerSkillWriteRoles, skill: writable });
    await grantAccess(fixture, { accessTag, roles: consumerSkillReadRoles, skill: readable });
    let authorization = await consumerAuthorization(fixture, accessTags);

    await expectServiceError(
      skillService.updateSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        skill: readable,
        authorization,
        input: { description: 'Should not apply' }
      }),
      'forbidden'
    );

    let updated = await skillService.updateSkill({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skill: writable,
      authorization,
      input: { description: 'Applied' }
    });
    expect(updated.description).toBe('Applied');
  });

  it('lets any organization member edit a skill another member created', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let memberScope = await memberFixture();
    expect(memberScope.member.id).not.toBe(fixture.member.id);

    let skill = await createSkill(fixture, {
      authorization: await memberAuthorization(fixture)
    });

    let updated = await skillService.updateSkill({
      project: memberScope.project,
      instance: memberScope.instance,
      auditScope: memberScope.auditScope,
      skill,
      authorization: await memberAuthorization(memberScope),
      input: { description: 'Edited by a member' }
    });
    expect(updated.description).toBe('Edited by a member');

    let row = await db.skill.findUniqueOrThrow({ where: { id: skill.id } });
    expect(row.description).toBe('Edited by a member');
  });

  it('gives the creator full store access and rejects a creator from another project', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let creator = await organizationResourceActor(fixture);

    let skill = await createSkill(fixture, {
      authorization: await memberAuthorization(fixture)
    });
    let storeParticipant = await db.storeParticipantActor.findFirstOrThrow({
      where: { store: { id: skill.storeId }, resourceActorOid: creator.oid }
    });
    expect([...storeParticipant.permissions].sort()).toEqual([
      'content_read',
      'content_write'
    ]);

    let skillId = await ID.generateId('skill');
    await expectServiceError(
      skillService.createSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        input: {
          id: skillId,
          authorization: await memberAuthorization(other),
          name: uniqueId('foreign-creator')
        }
      }),
      'bad_request'
    );
    expect(await db.skill.findUnique({ where: { id: skillId } })).toBeNull();
  });

  it('records skill use as editor participants with store access for members', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let memberScope = await memberFixture();
    let owner = await organizationResourceActor(fixture);
    let user = await organizationResourceActor(memberScope);
    let skill = await createSkill(fixture, {
      authorization: await memberAuthorization(fixture)
    });

    await skillService.markSkillUse({
      project: fixture.project,
      instance: fixture.instance,
      skill,
      actor: user
    });
    await skillService.markSkillUse({
      project: fixture.project,
      instance: fixture.instance,
      skill,
      actor: owner
    });

    let participants = await listParticipants(fixture, skill);
    let rolesByActor = new Map(
      participants.map(participant => [participant.resourceActor.id, participant.roles])
    );
    expect(rolesByActor.get(owner.id)).toEqual(['creator', 'editor']);
    expect(rolesByActor.get(user.id)).toEqual(['editor']);
    expect(participants).toHaveLength(2);

    let userStoreAccess = await db.storeParticipantActor.findFirstOrThrow({
      where: { store: { id: skill.storeId }, resourceActorOid: user.oid }
    });
    expect([...userStoreAccess.permissions].sort()).toEqual(['content_read', 'content_write']);

    let filtered = await listParticipants(fixture, skill, [user.id]);
    expect(filtered.map(participant => participant.resourceActor.id)).toEqual([user.id]);

    let other = await loadOrganizationFixture(otherOrg.ids);
    let foreignActor = await organizationResourceActor(other);
    await expectServiceError(
      skillService.markSkillUse({
        project: fixture.project,
        instance: fixture.instance,
        skill,
        actor: foreignActor
      }),
      'bad_request'
    );

    let rejected = await expectServiceError(
      skillService.markSkillUse({
        project: other.project,
        instance: other.instance,
        skill,
        actor: foreignActor
      }),
      'bad_request'
    );
    expect(rejected.message).toMatch(/does not belong/);
    expect(
      await db.skillParticipant.count({
        where: { skillOid: skill.oid, resourceActorOid: foreignActor.oid }
      })
    ).toBe(0);
    expect(
      await db.storeParticipantActor.count({
        where: { store: { id: skill.storeId }, resourceActorOid: foreignActor.oid }
      })
    ).toBe(0);
  });

  it('switches access roles while keeping explicit roles and never downgrading on use', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let actor = await organizationResourceActor(await memberFixture());

    let editor = await skillParticipantService.setSkillParticipantAccessRole({
      skill,
      actor,
      permission: 'write'
    });
    expect(editor?.roles).toEqual(['editor']);

    let kept = await skillParticipantService.ensureSkillParticipantAccessRole({
      skill,
      actor,
      permission: 'read'
    });
    expect(kept?.roles).toEqual(['editor']);

    let viewer = await skillParticipantService.setSkillParticipantAccessRole({
      skill,
      actor,
      permission: 'read'
    });
    expect(viewer?.roles).toEqual(['viewer']);

    let withUser = await skillParticipantService.ensureSkillParticipantRoles({
      skill,
      actor,
      roles: ['user', 'editor']
    });
    expect(withUser.roles).toEqual(['viewer', 'user']);

    let revoked = await skillParticipantService.setSkillParticipantAccessRole({
      skill,
      actor,
      permission: 'none'
    });
    expect(revoked?.roles).toEqual(['user']);

    let rows = await db.skillParticipant.findMany({ where: { skillOid: skill.oid } });
    expect(rows.map(row => row.roles)).toEqual([['user']]);

    let stranger = await resourceActorService.upsertActor({
      project: fixture.project,
      input: { identifier: uniqueId('e2e-stranger'), name: 'Stranger' }
    });
    let none = await skillParticipantService.setSkillParticipantAccessRole({
      skill,
      actor: stranger,
      permission: 'none'
    });
    expect(none).toBeUndefined();
    expect(
      await db.skillParticipant.count({
        where: { skillOid: skill.oid, resourceActorOid: stranger.oid }
      })
    ).toBe(0);
  });

  it('hides system participants and participants of other organizations', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let skill = await createSkill(fixture, {
      authorization: await memberAuthorization(fixture)
    });
    let system = await resourceActorService.upsertActor({
      project: fixture.project,
      input: { identifier: uniqueId('e2e-system'), name: 'System', type: 'system' }
    });
    let systemParticipant = await skillParticipantService.ensureSkillParticipantRoles({
      skill,
      actor: system,
      roles: ['user']
    });

    let participants = await listParticipants(fixture, skill);
    expect(participants.map(participant => participant.roles)).toEqual([['creator']]);
    await expectServiceError(
      skillParticipantService.getSkillParticipantById({
        project: fixture.project,
        instance: fixture.instance,
        skillParticipantId: systemParticipant.id
      }),
      'not_found'
    );

    let creator = await skillParticipantService.getSkillParticipantById({
      project: fixture.project,
      instance: fixture.instance,
      skillParticipantId: participants[0]!.id
    });
    expect(creator.skill.id).toBe(skill.id);

    await expectServiceError(
      skillParticipantService.getSkillParticipantById({
        project: other.project,
        instance: other.instance,
        skillParticipantId: participants[0]!.id
      }),
      'not_found'
    );
    expect(await listParticipants(other, skill)).toEqual([]);
  });
});
