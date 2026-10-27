import { uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { Fabric, type FabricEvents } from '@metorial/fabric';
import {
  accessTagService,
  createResourceAuthorization,
  type ResourceAuthorization,
  type RestrictedResourceActor
} from '@metorial/module-access';
import { documentService, flushDocumentDraft } from '@metorial/module-documents';
import { resourceActorService } from '@metorial/module-resource-actor';
import { storeVersionService } from '@metorial/module-store';
import { type SkillRecord, skillService } from '../src';

export let privileged = createResourceAuthorization({ restricted: false });

export let searchToken = () => uniqueId('srch').replace(/-/g, '');

export let organizationResourceActor = async (fixture: OrganizationFixture) =>
  await resourceActorService.ensureOrganizationActor({
    project: fixture.project,
    organizationActorOid: fixture.actor.oid
  });

export let memberAuthorization = async (fixture: OrganizationFixture) =>
  createResourceAuthorization({
    restricted: false,
    resourceActor: await organizationResourceActor(fixture)
  });

export let createSkill = async (
  fixture: OrganizationFixture,
  input: {
    name?: string;
    description?: string;
    authorization?: ResourceAuthorization;
    parentSkill?: SkillRecord;
    parentSkillCloneType?: 'fork' | 'duplicate';
  } = {}
) =>
  await skillService.createSkill({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    parentSkill: input.parentSkill,
    parentSkillCloneType: input.parentSkillCloneType,
    input: {
      id: await ID.generateId('skill'),
      authorization: input.authorization ?? privileged,
      name: input.name ?? uniqueId('skill'),
      description: input.description ?? 'Created by the e2e suite'
    }
  });

export let getSkill = async (
  fixture: OrganizationFixture,
  skillId: string,
  opts: { allowDeleted?: boolean } = {}
) =>
  await skillService.getSkillById({
    project: fixture.project,
    instance: fixture.instance,
    skillId,
    allowDeleted: opts.allowDeleted
  });

export let addDocument = async (
  fixture: OrganizationFixture,
  skill: Pick<SkillRecord, 'storeId'>,
  path: string,
  content: string
) =>
  await documentService.createDocument({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: {
      title: path.split('/').at(-1)!,
      content,
      authorization: privileged,
      store: { id: skill.storeId, path }
    }
  });

export let editDocument = async (
  fixture: OrganizationFixture,
  documentId: string,
  content: string
) => {
  let document = await documentService.getDocumentById({
    project: fixture.project,
    instance: fixture.instance,
    authorization: privileged,
    documentId
  });

  await documentService.updateDocument({
    project: fixture.project,
    instance: fixture.instance,
    document,
    input: { content, authorization: privileged }
  });

  await flushDocumentDraft({ documentId, force: true });
};

export let publishVersion = async (skill: Pick<SkillRecord, 'storeId'>) =>
  (await storeVersionService.createStoreVersionSnapshotNow({ storeId: skill.storeId }))
    .version;

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
      name: uniqueId('e2e-skill-policy'),
      roles: [...d.roles],
      organizationOid: fixture.organization.oid
    }
  });

  return await db.accessTagEntity.create({
    data: {
      accessTagOid: d.accessTag.oid,
      accessTagPolicyOid: policy.oid,
      skillOid: d.skill?.oid,
      skillGroupOid: d.skillGroup?.oid
    }
  });
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
