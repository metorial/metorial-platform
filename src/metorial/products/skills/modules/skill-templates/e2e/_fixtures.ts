import { eventually, uniqueId } from '@metorial/e2e';
import { db, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { Fabric, type FabricEvents } from '@metorial/fabric';
import { createResourceAuthorization } from '@metorial/module-access';
import { documentService } from '@metorial/module-documents';
import { skillService } from '@metorial/module-skill';
import { expect } from 'vitest';
import {
  type SkillTemplateCreateInput,
  type SkillTemplateRecord,
  skillTemplateService
} from '../src';

export type TemplateItems = NonNullable<SkillTemplateCreateInput['items']>;

export type SkillRecord = Awaited<ReturnType<typeof skillService.createSkill>>;

export let privileged = createResourceAuthorization({ restricted: false });

export let syncTimeout = { timeoutMs: 30_000, intervalMs: 500 };

export let scopeOf = (fixture: OrganizationFixture) => ({
  project: fixture.project,
  instance: fixture.instance
});

export let templateItems = (body = 'Template body'): TemplateItems => [
  {
    path: '/SKILL.md',
    type: 'document',
    content: `# Template\n\n${body}\n`,
    encoding: 'utf-8'
  },
  {
    path: '/references/guide.md',
    type: 'document',
    content: '# Guide\n\nRead me\n',
    encoding: 'utf-8'
  },
  { path: '/assets/', type: 'directory' }
];

export let createTemplate = async (
  fixture: OrganizationFixture,
  input: Partial<Omit<SkillTemplateCreateInput, 'id'>> = { items: templateItems() }
) =>
  await skillTemplateService.createSkillTemplate({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    input: {
      id: await ID.generateId('skillTemplate'),
      name: uniqueId('template'),
      description: 'Created by the e2e suite',
      ...input
    }
  });

export let createSkill = async (fixture: OrganizationFixture, name = uniqueId('skill')) =>
  await skillService.createSkill({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    input: {
      id: await ID.generateId('skill'),
      authorization: privileged,
      name
    }
  });

export let createSkillFromTemplate = async (
  fixture: OrganizationFixture,
  template: SkillTemplateRecord,
  name = uniqueId('skill')
) =>
  await skillService.createSkill({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    parentSkillTemplate: template,
    input: {
      id: await ID.generateId('skill'),
      authorization: privileged,
      name
    }
  });

export let addDocument = async (
  fixture: OrganizationFixture,
  storeId: string,
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
      store: { id: storeId, path }
    }
  });

export let storeFilePaths = async (storeId: string) =>
  (
    await db.storeItem.findMany({
      where: { store: { id: storeId }, kind: { not: 'directory' } },
      select: { path: true }
    })
  )
    .map(item => item.path)
    .sort();

export let storeDirectoryPaths = async (storeId: string) =>
  (
    await db.storeItem.findMany({
      where: { store: { id: storeId }, kind: 'directory' },
      select: { path: true }
    })
  )
    .map(item => item.path)
    .sort();

export let readStoreDocument = async (
  fixture: OrganizationFixture,
  storeId: string,
  path: string
) => {
  let item = await db.storeItem.findFirst({
    where: { store: { id: storeId }, path },
    include: { document: true }
  });
  if (!item?.document) return undefined;

  let document = await documentService.getDocumentById({
    ...scopeOf(fixture),
    authorization: privileged,
    documentId: item.document.id
  });

  return document.resolvedContent ?? document.content.content;
};

export let settledStoreTemplateHash = async (storeTemplateId: string, previous?: string) =>
  await eventually(async () => {
    let storeTemplate = await db.storeTemplate.findUniqueOrThrow({
      where: { id: storeTemplateId },
      include: { items: true }
    });

    expect(storeTemplate.hash).toBeTruthy();
    expect(storeTemplate.hash).not.toBe(previous);
    expect(storeTemplate.items.every(item => item.hash)).toBe(true);

    return storeTemplate.hash!;
  }, syncTimeout);

export let captureFabric = <K extends keyof FabricEvents>(event: K) => {
  let events: FabricEvents[K][] = [];
  let stop = Fabric.listen(event, data => {
    events.push(data);
  });

  return { events, stop };
};
