import { eventually, uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import {
  createResourceAuthorization,
  type ResourceAuthorization
} from '@metorial/module-access';
import {
  documentAuthoritativeWriteService,
  documentService
} from '@metorial/module-documents';
import { resourceActorService } from '@metorial/module-resource-actor';
import { skillService } from '@metorial/module-skill';
import { expect } from 'vitest';
import { skillMergeRequestService, type SkillMergeRequestRecord } from '../src';

export let mergeTimeout = { timeoutMs: 90_000, intervalMs: 500 };

export let privileged = createResourceAuthorization({ restricted: false });

export type SkillRecord = Awaited<ReturnType<typeof skillService.createSkill>>;

export let scopeOf = (fixture: OrganizationFixture) => ({
  project: fixture.project,
  instance: fixture.instance
});

export let createSkill = async (
  fixture: OrganizationFixture,
  input: { parent?: SkillRecord; authorization?: ResourceAuthorization } = {}
) =>
  await skillService.createSkill({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    parentSkill: input.parent,
    parentSkillCloneType: input.parent ? 'fork' : undefined,
    input: {
      id: await ID.generateId('skill'),
      authorization: input.authorization ?? privileged,
      name: uniqueId(input.parent ? 'fork' : 'upstream')
    }
  });

export let createForkPair = async (fixture: OrganizationFixture) => {
  let upstream = await createSkill(fixture);
  let fork = await createSkill(fixture, { parent: upstream });

  return { upstream, fork };
};

export let uniquePath = (prefix = 'doc') => `/${uniqueId(prefix)}.md`;

export let addDocument = async (
  fixture: OrganizationFixture,
  skill: SkillRecord,
  path: string,
  content: string
) =>
  await documentService.createDocument({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    input: {
      title: path.split('/').at(-1)!,
      content,
      authorization: privileged,
      store: { id: skill.store!.id, path }
    }
  });

export let findStoreItem = async (skill: SkillRecord, path: string) =>
  await db.storeItem.findFirst({
    where: { store: { id: skill.store!.id }, path },
    include: { document: true }
  });

let getStoreDocument = async (
  fixture: OrganizationFixture,
  skill: SkillRecord,
  path: string
) => {
  let item = await findStoreItem(skill, path);
  if (!item?.document) return undefined;

  return await documentService.getDocumentById({
    ...scopeOf(fixture),
    authorization: privileged,
    documentId: item.document.id
  });
};

export let readDocument = async (
  fixture: OrganizationFixture,
  skill: SkillRecord,
  path: string
) => {
  let document = await getStoreDocument(fixture, skill, path);
  if (!document) return undefined;

  return document.resolvedContent ?? document.content.content;
};

export let editDocument = async (
  fixture: OrganizationFixture,
  skill: SkillRecord,
  path: string,
  content: string
) => {
  let document = await getStoreDocument(fixture, skill, path);
  if (!document) throw new Error(`No document at ${path} in skill ${skill.id}`);

  await documentAuthoritativeWriteService.applyDocumentContent({
    ...scopeOf(fixture),
    document,
    input: {
      title: document.resolvedTitle ?? document.title,
      content,
      authorization: privileged
    }
  });
};

export let ensureResourceActor = async (fixture: OrganizationFixture) =>
  await resourceActorService.ensureOrganizationActor({
    project: fixture.project,
    organizationActorOid: fixture.actor.oid
  });

export let openMergeRequest = async (
  fixture: OrganizationFixture,
  fork: SkillRecord,
  input: { authorization?: ResourceAuthorization; title?: string } = {}
) =>
  await skillMergeRequestService.createSkillMergeRequest({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    authorization: input.authorization ?? privileged,
    sourceSkillId: fork.id,
    title: input.title ?? uniqueId('merge-request'),
    description: 'Created by the e2e suite'
  });

export let getMergeRequest = async (fixture: OrganizationFixture, id: string) =>
  await skillMergeRequestService.getSkillMergeRequestById({
    ...scopeOf(fixture),
    authorization: privileged,
    skillMergeRequestId: id
  });

export let getItemByPath = async (
  mergeRequest: Pick<SkillMergeRequestRecord, 'oid'>,
  path: string
) =>
  await db.skillMergeRequestItem.findFirstOrThrow({
    where: { skillMergeRequestOid: mergeRequest.oid, path }
  });

export let listItems = async (mergeRequest: Pick<SkillMergeRequestRecord, 'oid'>) =>
  await db.skillMergeRequestItem.findMany({
    where: { skillMergeRequestOid: mergeRequest.oid },
    orderBy: { path: 'asc' }
  });

export let documentItemPaths = async (mergeRequest: Pick<SkillMergeRequestRecord, 'oid'>) =>
  (await listItems(mergeRequest))
    .filter(item => item.kind === 'document')
    .map(item => item.path);

export let eventTypes = async (mergeRequest: Pick<SkillMergeRequestRecord, 'oid'>) =>
  (
    await db.skillMergeRequestEvent.findMany({
      where: { skillMergeRequestOid: mergeRequest.oid },
      orderBy: [{ createdAt: 'asc' }, { oid: 'asc' }]
    })
  ).map(event => event.type);

export let waitForMergeOutcome = async (mergeRequest: Pick<SkillMergeRequestRecord, 'id'>) =>
  await eventually(async () => {
    let row = await db.skillMergeRequest.findUniqueOrThrow({
      where: { id: mergeRequest.id }
    });
    expect(row.status).not.toBe('merging');
    return row;
  }, mergeTimeout);

export let mergeAndWait = async (
  fixture: OrganizationFixture,
  mergeRequest: SkillMergeRequestRecord,
  authorization: ResourceAuthorization = privileged
) => {
  let started = await skillMergeRequestService.performSkillMergeRequest({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    authorization,
    mergeRequest
  });
  expect(started.status).toBe('merging');

  return await waitForMergeOutcome(started);
};
