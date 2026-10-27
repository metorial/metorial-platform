import { uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { skillService } from '@metorial/module-skill';
import { afterAll, describe, expect, it } from 'vitest';
import { skillImportAcquireQueue } from '../src/queues/acquire';
import { skillImportDiscoverQueue } from '../src/queues/discover';
import { skillImportFinishQueue } from '../src/queues/finish';
import { skillImportItemQueue } from '../src/queues/item';
import {
  closeImportQueues,
  getImportRow,
  privileged,
  runJob,
  scopeOf,
  seedImport,
  seedItem,
  waitForImport
} from './_fixtures';

let acquire = (skillImportId: string) =>
  runJob(skillImportAcquireQueue.add({ skillImportId }));
let discover = (skillImportId: string) =>
  runJob(skillImportDiscoverQueue.add({ skillImportId }));
let processItem = (skillImportItemId: string) =>
  runJob(skillImportItemQueue.add({ skillImportItemId }));
let finish = (skillImportId: string) => runJob(skillImportFinishQueue.add({ skillImportId }));

let createSkill = async (fixture: OrganizationFixture) =>
  await skillService.createSkill({
    ...scopeOf(fixture),
    auditScope: fixture.auditScope,
    input: {
      id: await ID.generateId('skill'),
      authorization: privileged,
      name: uniqueId('skill')
    }
  });

describe('module-skill-import pipeline', () => {
  let org = useOrganization();

  afterAll(closeImportQueues);

  it('fails acquisition that has been running for longer than 30 minutes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skillImport = await seedImport(fixture, {
      status: 'pending',
      createdAt: new Date(Date.now() - 31 * 60 * 1000)
    });

    await acquire(skillImport.id);

    let row = await getImportRow(skillImport.id);
    expect(row).toMatchObject({
      status: 'failed',
      error: 'Repository acquisition timed out',
      startedAt: null,
      codeBucketId: null
    });
    expect(row.completedAt).toBeInstanceOf(Date);
  });

  it('fails acquisition when the import source is missing', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let cases = [
      {
        seed: { sourceType: 'public_repository' as const },
        error: 'Public repository URL is missing'
      },
      {
        seed: { sourceType: 'origin_repository' as const },
        error: 'Origin repository ID is missing'
      },
      {
        seed: { sourceType: 'uploaded_file' as const },
        error: 'Uploaded skill source file is missing'
      }
    ];

    for (let { seed, error } of cases) {
      let skillImport = await seedImport(fixture, { status: 'pending', ...seed });

      await acquire(skillImport.id);

      let row = await getImportRow(skillImport.id);
      expect(row, seed.sourceType).toMatchObject({ status: 'failed', error, items: [] });
      expect(row.startedAt).toBeInstanceOf(Date);
      expect(row.completedAt).toBeInstanceOf(Date);
    }
  });

  it('leaves finished imports alone when acquisition or discovery runs again', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let completed = await seedImport(fixture, { status: 'completed' });
    let failed = await seedImport(fixture, { status: 'failed' });
    let processingWithoutBucket = await seedImport(fixture, {
      status: 'processing',
      startedAt: new Date()
    });

    for (let skillImport of [completed, failed]) {
      await acquire(skillImport.id);
      await discover(skillImport.id);
    }
    await discover(processingWithoutBucket.id);

    for (let skillImport of [completed, failed, processingWithoutBucket]) {
      let row = await getImportRow(skillImport.id);
      expect(row).toMatchObject({ status: skillImport.status, error: null, items: [] });
      expect(row.updatedAt).toEqual(skillImport.updatedAt);
    }
  });

  it('fails an item whose import has no code bucket and completes the import', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skillImport = await seedImport(fixture, {
      status: 'processing',
      startedAt: new Date()
    });
    let item = await seedItem(skillImport, { status: 'pending' });

    await processItem(item.id);

    let row = await waitForImport(skillImport.id, current => current.status === 'completed');
    expect(row.completedAt).toBeInstanceOf(Date);
    expect(row.items).toHaveLength(1);
    expect(row.items[0]).toMatchObject({
      id: item.id,
      status: 'failed',
      error: 'Import codebucket is missing',
      skillOid: null
    });
    expect(row.items[0]!.startedAt).toBeInstanceOf(Date);
    expect(row.items[0]!.completedAt).toBeInstanceOf(Date);
    expect(row.items[0]!.cleanupCompletedAt).toBeInstanceOf(Date);
    expect(await db.skill.findUnique({ where: { id: item.targetSkillId } })).toBeNull();
  });

  it('does not start items of imports that are not processing', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    for (let status of ['pending', 'completed', 'failed'] as const) {
      let skillImport = await seedImport(fixture, { status });
      let item = await seedItem(skillImport, { status: 'pending' });

      await processItem(item.id);

      let row = await getImportRow(skillImport.id);
      expect(row.status, status).toBe(status);
      expect(row.items[0]).toMatchObject({ status: 'pending', startedAt: null, error: null });
    }
  });

  it('archives the skill of a failed item and waits for the remaining items', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skillImport = await seedImport(fixture, {
      status: 'processing',
      startedAt: new Date()
    });
    let skill = await createSkill(fixture);
    let failedItem = await seedItem(skillImport, {
      status: 'failed',
      skillOid: skill.oid,
      targetSkillId: skill.id
    });
    let pendingItem = await seedItem(skillImport, { status: 'pending' });

    await processItem(failedItem.id);

    let cleaned = await db.skillImportItem.findUniqueOrThrow({ where: { id: failedItem.id } });
    expect(cleaned).toMatchObject({ status: 'failed', skillOid: null });
    expect(cleaned.cleanupCompletedAt).toBeInstanceOf(Date);
    expect((await db.skill.findUniqueOrThrow({ where: { id: skill.id } })).status).toBe(
      'archived'
    );

    await finish(skillImport.id);
    let row = await getImportRow(skillImport.id);
    expect(row.status).toBe('processing');
    expect(row.items.find(item => item.id === pendingItem.id)?.status).toBe('pending');
  });

  it('archives an unlinked skill created for a failed item', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let skillImport = await seedImport(fixture, { status: 'completed' });
    let skill = await createSkill(fixture);
    let item = await seedItem(skillImport, { status: 'failed', targetSkillId: skill.id });

    await processItem(item.id);

    expect((await db.skill.findUniqueOrThrow({ where: { id: skill.id } })).status).toBe(
      'archived'
    );
    expect(
      (await db.skillImportItem.findUniqueOrThrow({ where: { id: item.id } }))
        .cleanupCompletedAt
    ).toBeInstanceOf(Date);
    expect((await getImportRow(skillImport.id)).status).toBe('completed');
  });

  it('completes a processing import once every item has finished', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let mixed = await seedImport(fixture, { status: 'processing', startedAt: new Date() });
    await seedItem(mixed, { status: 'completed' });
    await seedItem(mixed, { status: 'failed' });
    let allFailed = await seedImport(fixture, { status: 'processing', startedAt: new Date() });
    await seedItem(allFailed, { status: 'failed' });
    let running = await seedImport(fixture, { status: 'processing', startedAt: new Date() });
    await seedItem(running, { status: 'completed' });
    await seedItem(running, { status: 'processing' });
    let empty = await seedImport(fixture, { status: 'processing', startedAt: new Date() });
    let failedImport = await seedImport(fixture, { status: 'failed' });
    await seedItem(failedImport, { status: 'completed' });

    for (let skillImport of [mixed, allFailed, running, empty, failedImport]) {
      await finish(skillImport.id);
    }

    let mixedRow = await getImportRow(mixed.id);
    expect(mixedRow.status).toBe('completed');
    expect(mixedRow.completedAt).toBeInstanceOf(Date);
    expect((await getImportRow(allFailed.id)).status).toBe('completed');
    expect((await getImportRow(running.id)).status).toBe('processing');
    expect((await getImportRow(empty.id)).status).toBe('processing');
    expect((await getImportRow(failedImport.id)).status).toBe('failed');
  });
});
