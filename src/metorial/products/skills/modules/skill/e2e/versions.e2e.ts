import { expectServiceError, firstPage, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { storeService } from '@metorial/module-store';
import { skillTemplateService } from '@metorial/module-skill-templates';
import { describe, expect, it } from 'vitest';
import {
  type SkillRecord,
  skillResourceService,
  skillService,
  skillVersionService
} from '../src';
import {
  addDocument,
  captureFabric,
  createSkill,
  editDocument,
  memberAuthorization,
  privileged,
  publishVersion
} from './_fixtures';

let listVersions = async (
  fixture: OrganizationFixture,
  skill: SkillRecord,
  filters: { ids?: string[]; storeVersionIds?: string[] } = {}
) =>
  await firstPage(
    await skillVersionService.listSkillVersions({
      project: fixture.project,
      instance: fixture.instance,
      skill,
      ...filters
    })
  );

let getSnapshot = async (
  fixture: OrganizationFixture,
  skill: SkillRecord,
  skillVersionId: string
) =>
  await skillVersionService.getSkillVersionSnapshot({
    project: fixture.project,
    instance: fixture.instance,
    skill,
    skillVersionId
  });

let pathsOf = (snapshot: Awaited<ReturnType<typeof getSnapshot>>) =>
  snapshot.items.map(item => item.path).sort();

let contentAt = (
  snapshot: Awaited<ReturnType<typeof getSnapshot>>,
  path: string
): string | undefined => snapshot.items.find(item => item.path === path)?.content;

let storeItemAt = async (storeId: string, path: string) =>
  await db.storeItem.findFirst({
    where: { store: { id: storeId }, path },
    include: { document: true }
  });

describe('module-skill versions', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('has no versions until its store is snapshotted', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);

    expect(await listVersions(fixture, skill)).toEqual([]);
  });

  it('publishes numbered versions whose content stays fixed after later edits', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await createSkill(fixture);
    let skillMd = await addDocument(fixture, skill, '/SKILL.md', '# First\n\nfirst body');

    let firstStoreVersion = await publishVersion(skill);
    let [first] = await listVersions(fixture, skill);
    expect(first).toMatchObject({ versionNumber: 1, skill: { id: skill.id } });
    expect(first!.storeVersion.id).toBe(firstStoreVersion.id);

    let firstSnapshot = await getSnapshot(fixture, skill, first!.id);
    expect(firstSnapshot).toMatchObject({
      id: first!.id,
      skillId: skill.id,
      storeId: skill.storeId,
      storeVersionId: firstStoreVersion.id,
      versionNumber: 1
    });
    expect(pathsOf(firstSnapshot)).toEqual(['/', '/SKILL.md']);
    expect(firstSnapshot.items.find(item => item.path === '/SKILL.md')).toMatchObject({
      kind: 'document',
      documentId: skillMd.id
    });
    expect(contentAt(firstSnapshot, '/SKILL.md')).toBe('# First\n\nfirst body');

    await editDocument(fixture, skillMd.id, '# Second\n\nsecond body');
    await addDocument(fixture, skill, '/references/guide.md', '# Guide');

    let secondStoreVersion = await publishVersion(skill);
    let versions = await listVersions(fixture, skill);
    expect(versions.map(version => version.versionNumber)).toEqual([2, 1]);
    let second = versions[0]!;
    expect(second.storeVersion.id).toBe(secondStoreVersion.id);

    let secondSnapshot = await getSnapshot(fixture, skill, second.id);
    expect(pathsOf(secondSnapshot)).toEqual([
      '/',
      '/SKILL.md',
      '/references/',
      '/references/guide.md'
    ]);
    expect(contentAt(secondSnapshot, '/SKILL.md')).toBe('# Second\n\nsecond body');
    expect(contentAt(secondSnapshot, '/references/guide.md')).toBe('# Guide');

    let firstAgain = await getSnapshot(fixture, skill, first!.id);
    expect(pathsOf(firstAgain)).toEqual(['/', '/SKILL.md']);
    expect(contentAt(firstAgain, '/SKILL.md')).toBe('# First\n\nfirst body');

    let fetched = await skillVersionService.getSkillVersionById({
      project: fixture.project,
      instance: fixture.instance,
      skill,
      skillVersionId: first!.id
    });
    expect(fetched.versionNumber).toBe(1);

    let byStoreVersion = await listVersions(fixture, skill, {
      storeVersionIds: [firstStoreVersion.id]
    });
    expect(byStoreVersion.map(version => version.id)).toEqual([first!.id]);

    let byId = await listVersions(fixture, skill, { ids: [second.id] });
    expect(byId.map(version => version.id)).toEqual([second.id]);
  });

  it('does not resolve a version through another skill or organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let skill = await createSkill(fixture);
    let sibling = await createSkill(fixture);
    await addDocument(fixture, skill, '/SKILL.md', '# Versioned');
    await publishVersion(skill);
    let [version] = await listVersions(fixture, skill);

    await expectServiceError(
      skillVersionService.getSkillVersionById({
        project: fixture.project,
        instance: fixture.instance,
        skill: sibling,
        skillVersionId: version!.id
      }),
      'not_found'
    );
    await expectServiceError(getSnapshot(fixture, sibling, version!.id), 'not_found');
    expect(await listVersions(fixture, sibling, { ids: [version!.id] })).toEqual([]);

    await expectServiceError(
      skillVersionService.getSkillVersionById({
        project: other.project,
        instance: other.instance,
        skill,
        skillVersionId: version!.id
      }),
      'not_found'
    );
    await expectServiceError(getSnapshot(other, skill, version!.id), 'not_found');
  });

  it('forks a skill from a fresh snapshot of its parent and records the forker', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let authorization = await memberAuthorization(fixture);
    let parent = await createSkill(fixture);
    await addDocument(fixture, parent, '/SKILL.md', '# Parent');

    let created = captureFabric('skill.audit.created:after');
    let fork = await createSkill(fixture, {
      parentSkill: parent,
      parentSkillCloneType: 'fork',
      authorization
    }).finally(created.stop);

    let [baseVersion] = await listVersions(fixture, parent);
    expect(baseVersion?.versionNumber).toBe(1);

    let row = await db.skill.findUniqueOrThrow({
      where: { id: fork.id },
      include: { store: true }
    });
    expect(row).toMatchObject({
      parentSkillOid: parent.oid,
      forkedFromSkillVersionOid: baseVersion!.oid
    });
    expect(row.storeId).not.toBe(parent.storeId);
    expect(row.store?.cloneType).toBe('sync_until_change');
    expect(await storeItemAt(fork.storeId, '/SKILL.md')).toMatchObject({ kind: 'document' });

    let hydrated = await skillResourceService.hydrateSkill(fork, {
      instance: fixture.instance
    });
    expect(hydrated.hierarchy).toMatchObject({
      type: 'fork',
      parentSkillId: parent.id,
      fork: { id: fork.id, parentSkillId: parent.id }
    });

    let parentParticipants = await db.skillParticipant.findMany({
      where: { skillOid: parent.oid }
    });
    expect(parentParticipants.map(participant => participant.roles)).toEqual([['forker']]);
    expect(parentParticipants[0]!.resourceActorOid).toBe(authorization.resourceActor!.oid);

    let forkParticipants = await db.skillParticipant.findMany({
      where: { skillOid: fork.oid }
    });
    expect(forkParticipants.map(participant => participant.roles)).toEqual([['creator']]);

    expect(created.events.find(event => event.skill.id === fork.id)).toMatchObject({
      parentSkillId: parent.id,
      cloneType: 'fork'
    });
  });

  it('duplicates current content into an independent store without a fork base version', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let original = await createSkill(fixture);
    let originalSkillMd = await addDocument(fixture, original, '/SKILL.md', '# Original');

    let duplicate = await createSkill(fixture, {
      parentSkill: original,
      parentSkillCloneType: 'duplicate'
    });
    expect(await listVersions(fixture, original)).toEqual([]);

    let row = await db.skill.findUniqueOrThrow({
      where: { id: duplicate.id },
      include: { store: true }
    });
    expect(row.forkedFromSkillVersionOid).toBeNull();
    expect(row.store?.cloneType).toBe('duplicate');

    let duplicateItem = await storeItemAt(duplicate.storeId, '/SKILL.md');
    expect(duplicateItem?.document?.id).toBeTruthy();
    expect(duplicateItem!.document!.id).not.toBe(originalSkillMd.id);

    await editDocument(fixture, duplicateItem!.document!.id, '# Duplicate edited');
    await publishVersion(duplicate);
    await publishVersion(original);

    let [duplicateVersion] = await listVersions(fixture, duplicate);
    let [originalVersion] = await listVersions(fixture, original);
    expect(
      contentAt(await getSnapshot(fixture, duplicate, duplicateVersion!.id), '/SKILL.md')
    ).toBe('# Duplicate edited');
    expect(
      contentAt(await getSnapshot(fixture, original, originalVersion!.id), '/SKILL.md')
    ).toBe('# Original');
  });

  it('creates a skill from the default template with a protected SKILL.md', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await skillTemplateService.getDefaultSkillTemplate({
      project: fixture.project,
      instance: fixture.instance
    });

    let created = captureFabric('skill.audit.created:after');
    let skill = await skillService
      .createSkill({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        parentSkillTemplate: template,
        input: {
          id: await ID.generateId('skill'),
          authorization: privileged,
          name: 'Templated e2e skill'
        }
      })
      .finally(created.stop);
    expect(
      created.events.find(event => event.skill.id === skill.id)?.parentSkillTemplateId
    ).toBe(template.id);

    let skillMd = await storeItemAt(skill.storeId, '/SKILL.md');
    expect(skillMd).toMatchObject({ kind: 'document' });
    expect(skillMd?.document?.title).toBe('Templated e2e skill');

    let removal = await expectServiceError(
      storeService.modifyStoreItems({
        project: fixture.project,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        authorization: privileged,
        store: skill.store!,
        operations: [{ type: 'remove', itemId: skillMd!.id }]
      }),
      'bad_request'
    );
    expect(removal.message).toMatch(/SKILL.md cannot be removed/);
    expect(await storeItemAt(skill.storeId, '/SKILL.md')).not.toBeNull();
  });
});
