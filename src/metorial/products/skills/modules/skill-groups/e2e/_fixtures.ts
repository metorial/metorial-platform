import { firstPage, uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { Fabric, type FabricEvents } from '@metorial/fabric';
import {
  accessTagService,
  createResourceAuthorization,
  type ResourceAuthorization,
  type RestrictedResourceActor,
  storeAccessGrantService
} from '@metorial/module-access';
import { resourceActorService } from '@metorial/module-resource-actor';
import { type SkillRecord, skillService } from '@metorial/module-skill';
import { type SkillGroupRecord, skillGroupItemService, skillGroupService } from '../src';

export let privileged = createResourceAuthorization({ restricted: false });

export let searchToken = () => uniqueId('srch').replace(/-/g, '');

export let createSkill = async (
  fixture: OrganizationFixture,
  input: { name?: string; description?: string } = {}
) =>
  await skillService.createSkill({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: {
      id: await ID.generateId('skill'),
      authorization: privileged,
      name: input.name ?? uniqueId('skill'),
      description: input.description
    }
  });

export let archiveSkill = async (fixture: OrganizationFixture, skill: SkillRecord) =>
  await skillService.archiveSkill({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    skill,
    authorization: privileged
  });

export let createGroup = async (
  fixture: OrganizationFixture,
  input: Partial<Parameters<typeof skillGroupService.createSkillGroup>[0]['input']> = {}
) =>
  await skillGroupService.createSkillGroup({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('group'), ...input }
  });

export let updateGroup = async (
  fixture: OrganizationFixture,
  group: Pick<SkillGroupRecord, 'id'>,
  input: Parameters<typeof skillGroupService.updateSkillGroup>[0]['input']
) =>
  await skillGroupService.updateSkillGroup({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    skillGroupId: group.id,
    input
  });

export let archiveGroup = async (
  fixture: OrganizationFixture,
  group: Pick<SkillGroupRecord, 'id'>
) =>
  await skillGroupService.archiveSkillGroup({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    skillGroupId: group.id
  });

export let addToGroup = async (
  fixture: OrganizationFixture,
  group: Pick<SkillGroupRecord, 'id'>,
  skill: Pick<SkillRecord, 'id'>
) =>
  await skillGroupItemService.createSkillGroupItem({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: { skillGroupId: group.id, skillId: skill.id }
  });

export let getGroup = async (
  fixture: OrganizationFixture,
  group: Pick<SkillGroupRecord, 'id'>,
  opts: { allowDeleted?: boolean } = {}
) =>
  await skillGroupService.getSkillGroupById({
    project: fixture.project,
    instance: fixture.instance,
    skillGroupId: group.id,
    ...opts
  });

export let listGroups = async (
  fixture: OrganizationFixture,
  filters: Omit<
    Parameters<typeof skillGroupService.listSkillGroups>[0],
    'project' | 'instance'
  > = {}
) =>
  await firstPage(
    await skillGroupService.listSkillGroups({
      project: fixture.project,
      instance: fixture.instance,
      ...filters
    })
  );

export let listItems = async (
  fixture: OrganizationFixture,
  filters: Omit<
    Parameters<typeof skillGroupItemService.listSkillGroupItems>[0],
    'project' | 'instance'
  > = {}
) =>
  await firstPage(
    await skillGroupItemService.listSkillGroupItems({
      project: fixture.project,
      instance: fixture.instance,
      ...filters
    })
  );

export let skillIdsOf = (group: SkillGroupRecord) => group.items.map(item => item.skill.id);

export let createConsumerAccessTag = async (fixture: OrganizationFixture) => {
  let accessTag = await accessTagService.createAccessTag({ instance: fixture.instance });
  return { accessTag, accessTags: [{ accessTagOid: accessTag.oid }] };
};

export let grantAccess = async (
  fixture: OrganizationFixture,
  d: {
    accessTag: { oid: bigint };
    roles: readonly string[];
    skill?: { oid: bigint };
    skillGroup?: { oid: bigint };
  }
) => {
  let policy = await db.accessTagPolicy.create({
    data: {
      id: await ID.generateId('accessTagPolicy'),
      name: uniqueId('e2e-group-policy'),
      roles: [...d.roles],
      organizationOid: fixture.organization.oid
    }
  });

  let entity = await db.accessTagEntity.create({
    data: {
      accessTagOid: d.accessTag.oid,
      accessTagPolicyOid: policy.oid,
      skillOid: d.skill?.oid,
      skillGroupOid: d.skillGroup?.oid
    }
  });

  if (d.skill) {
    await storeAccessGrantService.syncLegacySkillGrants({ skillOid: d.skill.oid });
  }

  return entity;
};

// Restricted authorizations normally come from a consumer profile; the skill and store write
// checks only read the actor's oid and project, so a plain resource actor stands in for one.
export let consumerAuthorization = async (
  fixture: OrganizationFixture,
  accessTags: { accessTagOid: bigint }[]
): Promise<ResourceAuthorization> => {
  let actor = await resourceActorService.upsertActor({
    project: fixture.project,
    input: { identifier: uniqueId('e2e-consumer'), name: 'E2E consumer' }
  });

  return {
    type: 'restricted',
    resourceActor: actor as RestrictedResourceActor,
    accessTags
  };
};

export let captureFabric = <K extends keyof FabricEvents>(event: K) => {
  let events: FabricEvents[K][] = [];
  let stop = Fabric.listen(event, data => {
    events.push(data);
  });

  return { events, stop };
};
