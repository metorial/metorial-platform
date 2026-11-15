import { hashBytes } from '@lowerdeck/hash/content';
import { eventually, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { getCargoFilesBucketName, getStorage } from '@metorial/module-file';
import { beforeAll, describe, expect, it } from 'vitest';
import { skillSyncService } from '../src';
import {
  manifestFormatVersion,
  uploadManifestFile,
  writeManifestFile,
  type ManifestEntry
} from '../src/lib/manifestFile';
import { getMarketplaceManifestScope } from '../src/queues/sync/_lib/scope';
import {
  performSkillSyncPropagation,
  startSkillSyncPropagation,
  waitForSkillSyncPropagation
} from '../src/queues/sync/propagate';
import { checkSkillRepositoryDrift, repairSkillRepository } from '../src/queues/sync/repair';
import {
  captureFabric,
  createMarketplace,
  createPlugin,
  holdSyncStageQueues,
  useFakeOrigin
} from './_fixtures';

// The stack worker cannot reach the fake Origin, so these tests drive the repository stage
// in-process with the stage queues held. Content-stage state (manifests, syncs) is seeded directly.
describe('manifest propagation', () => {
  let origin = useFakeOrigin();
  let org = useOrganization();

  let fixture: OrganizationFixture;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
  });

  let blobEntry = async (path: string, content: string): Promise<ManifestEntry> => {
    let hashes = hashBytes(content);
    let key = `skill-sync/blobs/sha256/${hashes.sha256}`;
    await getStorage().putObject(getCargoFilesBucketName(), key, content);

    return { path, key, ...hashes };
  };

  let setup = async (
    opts: { repositoryAccessMode?: 'pull_request' | 'default_branch' } = {}
  ) => {
    let stages = holdSyncStageQueues();
    let marketplace = await createMarketplace(fixture, {
      repositoryAccessMode: opts.repositoryAccessMode ?? 'pull_request'
    });
    let destination = await db.skillDestination.update({
      where: { oid: marketplace.destinationOid! },
      data: {
        storageMode: 'manifest',
        syncRecoveryVersion: 1,
        isDirty: false,
        shouldFlushAt: null,
        mustFlushAt: null
      }
    });

    let repoId = origin.addRepository({ owner: 'acme', name: uniqueId('skills') });
    let repository = await db.skillRepository.create({
      data: {
        id: await ID.generateId('skillRepository'),
        repoId,
        projectOid: fixture.project.oid,
        instanceOid: fixture.instance.oid
      }
    });
    await db.skillMarketplaceRepository.create({
      data: {
        id: await ID.generateId('skillMarketplaceRepository'),
        skillMarketplaceOid: marketplace.oid,
        skillRepositoryOid: repository.oid
      }
    });

    return { stages, marketplace, destination, repository };
  };

  type Setup = Awaited<ReturnType<typeof setup>>;

  let storeManifest = async (target: Setup, files: Record<string, string>) => {
    let entries = await Promise.all(
      Object.entries(files).map(([path, content]) => blobEntry(path, content))
    );
    let written = await writeManifestFile({
      destinationId: target.destination.id,
      sourceBucket: getCargoFilesBucketName(),
      scope: getMarketplaceManifestScope(),
      entries
    });
    let ref = await uploadManifestFile({
      destinationId: target.destination.id,
      manifest: written
    });

    let manifest = await db.skillDestinationManifest.upsert({
      where: {
        destinationOid_sha256: { destinationOid: target.destination.oid, sha256: ref.sha256 }
      },
      create: {
        id: await ID.generateId('skillDestinationManifest'),
        sha256: ref.sha256,
        objectKey: ref.key,
        formatVersion: manifestFormatVersion,
        entryCount: ref.entryCount,
        totalBytes: BigInt(written.totalBytes),
        destinationOid: target.destination.oid
      },
      update: {}
    });
    await db.skillDestination.update({
      where: { oid: target.destination.oid },
      data: { currentManifestOid: manifest.oid }
    });

    return manifest;
  };

  let startSync = async (
    target: Setup,
    manifest: { oid: bigint },
    opts: { trigger?: 'automatic' | 'manual' | 'drift_check'; allowMassDelete?: boolean } = {}
  ) => {
    let sync = await db.skillDestinationSync.create({
      data: {
        id: await ID.generateId('skillDestinationSync'),
        destinationOid: target.destination.oid,
        status: 'processing',
        storageMode: 'manifest',
        trigger: opts.trigger ?? 'automatic',
        allowMassDelete: opts.allowMassDelete ?? false,
        manifestOid: manifest.oid,
        startedAt: new Date(),
        prName: 'Sync marketplace'
      }
    });
    await startSkillSyncPropagation({ skillDestinationSyncId: sync.id, contentVersion: 0 });

    return sync;
  };

  let propagationOf = async (sync: { oid: bigint }) =>
    await db.skillDestinationSyncRepositoryPropagation.findFirstOrThrow({
      where: { skillDestinationSyncOid: sync.oid }
    });

  let send = async (sync: { id: string; oid: bigint }) => {
    let propagation = await propagationOf(sync);
    await performSkillSyncPropagation({
      skillDestinationSyncId: sync.id,
      processedPropagationIds: [],
      pendingPropagationIds: [propagation.id]
    });
    return await propagationOf(sync);
  };

  let poll = async (sync: { id: string; oid: bigint }) => {
    let propagation = await propagationOf(sync);
    await waitForSkillSyncPropagation({
      skillDestinationSyncId: sync.id,
      pendingPropagationIds: [propagation.id]
    });
    return await propagationOf(sync);
  };

  let callsFor = (target: Setup) =>
    origin
      .syncManifestCalls()
      .filter(call => call.payload.sourceKey === target.destination.id);

  let repositoryOf = async (target: Setup) =>
    await db.skillRepository.findUniqueOrThrow({ where: { oid: target.repository.oid } });

  let pullRequestUrl = async (sync: { id: string }) =>
    (
      await skillSyncService.getSkillSyncRepositoryChecks({
        project: fixture.project,
        instance: fixture.instance,
        skillSyncId: sync.id
      })
    )[0]?.pullRequestUrl;

  it('sends the manifest with the last propagated manifest and records base-branch outcomes', async () => {
    let target = await setup();
    let first = await storeManifest(target, { 'plugins/a/SKILL.md': `# A ${uniqueId('a')}` });
    let second = await storeManifest(target, {
      'plugins/a/SKILL.md': `# A ${uniqueId('a')}`,
      'plugins/b/SKILL.md': '# B'
    });

    let firstSync = await startSync(target, first);
    expect((await send(firstSync)).status).toBe('processing');
    expect((await poll(firstSync)).status).toBe('completed');
    expect(await repositoryOf(target)).toMatchObject({
      lastPropagatedManifestOid: first.oid,
      lastDriftCheckAt: expect.any(Date),
      repairAttempts: 0,
      nextRepairAt: null
    });

    let secondSync = await startSync(target, second);
    await send(secondSync);

    let [firstCall, secondCall] = callsFor(target);
    expect(firstCall!.payload).toMatchObject({
      requestKey: (await propagationOf(firstSync)).id,
      manifest: { sha256: first.sha256, entryCount: 1 },
      deletionGuard: { maxUnexpectedDeletes: 250, maxUnexpectedDeleteRatio: 0.1 },
      allowMassDelete: false
    });
    expect(firstCall!.payload.previousManifest).toBeUndefined();
    expect(secondCall!.payload).toMatchObject({
      manifest: { sha256: second.sha256 },
      previousManifest: { sha256: first.sha256, key: first.objectKey }
    });
    expect(
      (await origin.readPreviousManifest(secondCall!))?.entries.map(entry => entry.path)
    ).toEqual(['plugins/a/SKILL.md']);
  });

  it('does not record an unmerged pull request as propagated', async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': '# A' });
    origin.queueSyncManifestResponses({ status: 'complete_unmerged' });

    let sync = await startSync(target, manifest);
    await send(sync);

    expect((await poll(sync)).status).toBe('completed');
    expect((await repositoryOf(target)).lastPropagatedManifestOid).toBeNull();
  });

  it('completes an unchanged repository locally and still sends a manual sync', async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });

    let first = await startSync(target, manifest);
    await send(first);
    await poll(first);
    expect(callsFor(target)).toHaveLength(1);

    let unchanged = await startSync(target, manifest);
    expect((await send(unchanged)).status).toBe('completed');
    expect(callsFor(target)).toHaveLength(1);

    let manual = await startSync(target, manifest, { trigger: 'manual' });
    expect((await send(manual)).originSyncId).not.toBeNull();
    expect(callsFor(target)).toHaveLength(2);

    await db.skillRepository.update({
      where: { oid: target.repository.oid },
      data: { lastDriftCheckAt: new Date(Date.now() - 25 * 60 * 60 * 1000) }
    });
    let stale = await startSync(target, manifest);
    expect((await send(stale)).originSyncId).not.toBeNull();
    expect(callsFor(target)).toHaveLength(3);
  });

  it('continues an edit made while the previous sync waits for review in the same pull request', async () => {
    let target = await setup();
    let first = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('v1')}` });
    let second = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('v2')}` });
    let prUrl = `https://github.com/acme/skills/pull/${uniqueId('pr')}`;
    origin.queueSyncManifestResponses(
      { status: 'waiting_for_review', providerPrUrl: prUrl },
      { status: 'waiting_for_review', providerPrUrl: prUrl }
    );

    let firstSync = await startSync(target, first);
    let firstPropagation = await send(firstSync);
    expect((await poll(firstSync)).status).toBe('waiting_for_review');

    let secondSync = await startSync(target, second);
    await send(secondSync);
    origin.updateSync(firstPropagation.originSyncId!, {
      status: 'cancelled',
      endReason: 'superseded'
    });

    let superseded = await poll(firstSync);
    expect(superseded).toMatchObject({ status: 'canceled', endReason: 'superseded' });
    expect(superseded.errorCode).toBeNull();
    expect((await poll(secondSync)).status).toBe('waiting_for_review');
    expect(await pullRequestUrl(secondSync)).toBe(prUrl);
    expect(await pullRequestUrl(firstSync)).toBe(prUrl);
    expect((await repositoryOf(target)).dismissedManifestSha256).toBeNull();
  });

  it('cancels a closed pull request, never repairs it and starts a new one for the next edit', async () => {
    let target = await setup();
    let first = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('v1')}` });
    origin.queueSyncManifestResponses({ status: 'waiting_for_review' });

    let firstSync = await startSync(target, first);
    let propagation = await send(firstSync);
    await poll(firstSync);
    origin.updateSync(propagation.originSyncId!, {
      status: 'cancelled',
      endReason: 'pull_request_closed'
    });

    expect(await poll(firstSync)).toMatchObject({
      status: 'canceled',
      endReason: 'pull_request_closed'
    });
    expect(await repositoryOf(target)).toMatchObject({
      dismissedManifestSha256: first.sha256,
      nextRepairAt: null
    });

    await db.skillRepository.update({
      where: { oid: target.repository.oid },
      data: { nextRepairAt: new Date(Date.now() - 1000) }
    });
    await repairSkillRepository({ skillRepositoryId: target.repository.id });
    expect((await repositoryOf(target)).nextRepairAt).toBeNull();
    expect(
      await db.skillDestinationSync.count({
        where: { destinationOid: target.destination.oid, trigger: 'repair' }
      })
    ).toBe(0);

    let sameContent = await startSync(target, first);
    expect((await send(sameContent)).status).toBe('completed');
    expect(callsFor(target)).toHaveLength(1);

    let second = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('v2')}` });
    origin.queueSyncManifestResponses({
      status: 'waiting_for_review',
      providerPrUrl: 'https://github.com/acme/skills/pull/2'
    });
    let nextEdit = await startSync(target, second);
    let reopened = await send(nextEdit);
    expect(reopened.originSyncId).not.toBe(propagation.originSyncId);
    expect(callsFor(target)).toHaveLength(2);
    expect(await pullRequestUrl(nextEdit)).toBe('https://github.com/acme/skills/pull/2');
  });

  it('fails a tripped deletion guard with its code and lets a forced sync allow the deletes', async () => {
    let target = await setup({ repositoryAccessMode: 'default_branch' });
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    origin.queueSyncManifestResponses({
      status: 'failed',
      errorCode: 'deletion_guard_tripped',
      errorDetails: { unexpectedDeletes: 300, paths: ['plugins/old/README.md'] }
    });

    let sync = await startSync(target, manifest);
    await send(sync);
    let failed = await poll(sync);

    expect(failed).toMatchObject({
      status: 'failed',
      errorCode: 'deletion_guard_tripped',
      errorMessage:
        "Sync would delete 300 files Metorial didn't expect; review and force the sync to continue."
    });
    expect((await repositoryOf(target)).nextRepairAt).toBeNull();
    expect(
      (await db.skillDestinationSync.findUniqueOrThrow({ where: { oid: sync.oid } })).status
    ).toBe('failed');

    let audit = captureFabric('skill.destination.audit.sync_forced:after');
    let forced = await skillSyncService.forceSkillSync({
      project: fixture.project,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      skillSyncId: sync.id,
      allowMassDelete: true
    });
    audit.stop();

    let forcedRow = await db.skillDestinationSync.findUniqueOrThrow({
      where: { id: forced.id }
    });
    expect(forcedRow).toMatchObject({ allowMassDelete: true, trigger: 'manual' });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]!.skillDestinationSync.id).toBe(forced.id);

    await db.skillDestinationSync.update({
      where: { oid: forcedRow.oid },
      data: { status: 'canceled', completedAt: new Date() }
    });
    let retry = await startSync(target, manifest, {
      trigger: 'manual',
      allowMassDelete: true
    });
    await send(retry);
    expect(callsFor(target).at(-1)!.payload.allowMassDelete).toBe(true);
    expect((await poll(retry)).status).toBe('completed');
  });

  let seedAppliedItems = async (target: Setup) => {
    // Standalone so the marketplace destination stays clean and the stack's flush cron leaves it alone.
    let plugin = await createPlugin(fixture);
    let missingKey = `skill-sync/blobs/sha256/${uniqueId('missing')}`;
    let marketplaceItem = await db.skillDestinationItem.create({
      data: {
        destinationOid: target.destination.oid,
        skillMarketplaceOid: target.marketplace.oid,
        hash: 'applied'
      }
    });
    let pluginItem = await db.skillDestinationItem.create({
      data: {
        destinationOid: target.destination.oid,
        skillPluginOid: plugin.oid,
        hash: 'applied'
      }
    });
    await db.skillDestinationFile.createMany({
      data: [
        {
          destinationOid: target.destination.oid,
          path: '.claude-plugin/marketplace.json',
          signature: 'sha256:applied',
          itemKey: `marketplace:${target.marketplace.id}`,
          sourceKind: 'blob',
          sourceKey: missingKey
        },
        {
          destinationOid: target.destination.oid,
          path: `plugins/${plugin.id}/.claude-plugin/plugin.json`,
          signature: 'sha256:applied',
          itemKey: `plugin:${plugin.id}`,
          sourceKind: 'blob',
          sourceKey: `skill-sync/blobs/sha256/${uniqueId('present')}`
        }
      ]
    });

    let itemHashes = async () => {
      let [marketplace, plugin] = await Promise.all(
        [marketplaceItem.oid, pluginItem.oid].map(oid =>
          db.skillDestinationItem.findUniqueOrThrow({ where: { oid } })
        )
      );
      return { marketplace: marketplace!.hash, plugin: plugin!.hash };
    };
    let resetHashes = async () =>
      await db.skillDestinationItem.updateMany({
        where: { oid: { in: [marketplaceItem.oid, pluginItem.oid] } },
        data: { hash: 'applied' }
      });

    return { missingKey, itemHashes, resetHashes };
  };

  it('rebuilds missing sources in a new sync and gives up after three recoveries a day', async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    let { missingKey, itemHashes } = await seedAppliedItems(target);
    origin.queueSyncManifestResponses({
      status: 'failed',
      errorCode: 'source_not_found',
      errorDetails: { keys: [missingKey] }
    });

    let sync = await startSync(target, manifest);
    await send(sync);
    expect(await poll(sync)).toMatchObject({
      status: 'failed',
      errorCode: 'source_not_found'
    });

    let recoveries = await db.skillDestinationSync.findMany({
      where: { destinationOid: target.destination.oid, trigger: 'recovery' }
    });
    expect(recoveries).toHaveLength(1);
    expect(recoveries[0]!.oid).toBeGreaterThan(sync.oid);
    expect(target.stages.jobs('start')).toContainEqual({
      skillDestinationSyncId: recoveries[0]!.id
    });
    expect(await itemHashes()).toEqual({ marketplace: '', plugin: 'applied' });

    await db.skillDestinationSync.updateMany({
      where: { destinationOid: target.destination.oid, trigger: 'recovery' },
      data: { status: 'completed', completedAt: new Date() }
    });
    for (let i = 0; i < 2; i++) {
      await db.skillDestinationSync.create({
        data: {
          id: await ID.generateId('skillDestinationSync'),
          destinationOid: target.destination.oid,
          status: 'completed',
          trigger: 'recovery',
          storageMode: 'manifest',
          completedAt: new Date()
        }
      });
    }

    origin.queueSyncManifestResponses({ status: 'failed', errorCode: 'source_not_found' });
    let fourth = await startSync(target, manifest);
    await send(fourth);
    expect(await poll(fourth)).toMatchObject({
      status: 'failed',
      errorCode: 'source_not_found',
      errorMessage: 'Files are still missing from storage after repeated rebuilds.'
    });
    expect(
      await db.skillDestinationSync.count({
        where: { destinationOid: target.destination.oid, trigger: 'recovery' }
      })
    ).toBe(3);
    expect(await repositoryOf(target)).toMatchObject({
      sourceRecoveryLimitWindows: 1,
      sourceRecoveryLimitReachedAt: expect.any(Date)
    });
  });

  let seedRecoveries = async (target: Setup, count: number) => {
    for (let i = 0; i < count; i++) {
      await db.skillDestinationSync.create({
        data: {
          id: await ID.generateId('skillDestinationSync'),
          destinationOid: target.destination.oid,
          status: 'completed',
          trigger: 'recovery',
          storageMode: 'manifest',
          completedAt: new Date()
        }
      });
    }
  };

  let expectNoRepair = async (target: Setup) => {
    await db.skillRepository.update({
      where: { oid: target.repository.oid },
      data: { nextRepairAt: new Date(Date.now() - 1000) }
    });
    let syncs = await db.skillDestinationSync.count({
      where: { destinationOid: target.destination.oid }
    });
    await repairSkillRepository({ skillRepositoryId: target.repository.id });
    expect(
      await db.skillDestinationSync.count({
        where: { destinationOid: target.destination.oid }
      })
    ).toBe(syncs);
  };

  it('rebuilds the item behind a content mismatch like a missing source', async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    let { missingKey, itemHashes } = await seedAppliedItems(target);
    origin.queueSyncManifestResponses({
      status: 'failed',
      errorCode: 'content_mismatch',
      errorDetails: { key: missingKey }
    });

    let sync = await startSync(target, manifest);
    await send(sync);
    expect(await poll(sync)).toMatchObject({
      status: 'failed',
      errorCode: 'content_mismatch',
      errorMessage:
        "Some stored files didn't match their recorded content. Metorial rebuilds them and retries automatically."
    });

    let recoveries = await db.skillDestinationSync.findMany({
      where: { destinationOid: target.destination.oid, trigger: 'recovery' }
    });
    expect(recoveries).toHaveLength(1);
    expect(target.stages.jobs('start')).toContainEqual({
      skillDestinationSyncId: recoveries[0]!.id
    });
    expect(await itemHashes()).toEqual({ marketplace: '', plugin: 'applied' });

    await db.skillDestinationSync.updateMany({
      where: { destinationOid: target.destination.oid, trigger: 'recovery' },
      data: { status: 'completed', completedAt: new Date() }
    });
    await seedRecoveries(target, 2);
    origin.queueSyncManifestResponses({
      status: 'failed',
      errorCode: 'content_mismatch',
      errorDetails: { key: missingKey }
    });
    let limited = await startSync(target, manifest);
    await send(limited);
    expect(await poll(limited)).toMatchObject({
      status: 'failed',
      errorCode: 'content_mismatch',
      errorMessage: "Stored files still don't match their content after repeated rebuilds."
    });
    expect(
      await db.skillDestinationSync.count({
        where: { destinationOid: target.destination.oid, trigger: 'recovery' }
      })
    ).toBe(3);
  });

  it('stops rebuilding after the recovery limit is hit on consecutive days', async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    let { missingKey } = await seedAppliedItems(target);
    await seedRecoveries(target, 3);
    await db.skillRepository.update({
      where: { oid: target.repository.oid },
      data: {
        sourceRecoveryLimitWindows: 2,
        sourceRecoveryLimitReachedAt: new Date(Date.now() - 25 * 60 * 60 * 1000)
      }
    });
    origin.queueSyncManifestResponses({
      status: 'failed',
      errorCode: 'source_not_found',
      errorDetails: { keys: [missingKey] }
    });

    let sync = await startSync(target, manifest);
    await send(sync);
    expect(await poll(sync)).toMatchObject({
      status: 'failed',
      errorCode: 'recovery_exhausted',
      errorMessage:
        'Metorial kept failing to rebuild missing or damaged files and stopped retrying. Edit or re-save the affected skills, then sync again.'
    });
    expect(await repositoryOf(target)).toMatchObject({
      sourceRecoveryLimitWindows: 3,
      nextRepairAt: null
    });
    expect(
      await db.skillDestinationSync.count({
        where: { destinationOid: target.destination.oid, trigger: 'recovery' }
      })
    ).toBe(3);
    await expectNoRepair(target);

    let retry = await startSync(target, manifest, { trigger: 'manual' });
    await send(retry);
    expect((await poll(retry)).status).toBe('completed');
    expect(await repositoryOf(target)).toMatchObject({
      sourceRecoveryLimitWindows: 0,
      sourceRecoveryLimitReachedAt: null
    });
  });

  it('fails a tree too large to compare for the user to fix without repairing', async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    origin.queueSyncManifestResponses({ status: 'failed', errorCode: 'tree_too_large' });

    let sync = await startSync(target, manifest);
    await send(sync);
    expect(await poll(sync)).toMatchObject({
      status: 'failed',
      errorCode: 'tree_too_large',
      errorMessage:
        'The repository has too many folders for Metorial to compare. Sync into a smaller repository or remove unrelated folders from it, then sync again.'
    });
    expect((await repositoryOf(target)).nextRepairAt).toBeNull();
    await expectNoRepair(target);
  });

  it('dismisses a sync whose branch Origin found deleted', async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    origin.queueSyncManifestResponses({ status: 'waiting_for_review' });

    let sync = await startSync(target, manifest);
    let propagation = await send(sync);
    await poll(sync);
    origin.updateSync(propagation.originSyncId!, {
      status: 'cancelled',
      endReason: 'branch_deleted'
    });

    let canceled = await poll(sync);
    expect(canceled).toMatchObject({ status: 'canceled', endReason: 'branch_deleted' });
    expect(canceled.errorCode).toBeNull();
    expect(await repositoryOf(target)).toMatchObject({
      dismissedManifestSha256: manifest.sha256,
      nextRepairAt: null
    });
    await expectNoRepair(target);

    let sameContent = await startSync(target, manifest);
    expect((await send(sameContent)).status).toBe('completed');
    expect(callsFor(target)).toHaveLength(1);
  });

  it('records a drift check only once it completes', async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    let first = await startSync(target, manifest);
    await send(first);
    await poll(first);

    let staleAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await db.skillRepository.update({
      where: { oid: target.repository.oid },
      data: { lastDriftCheckAt: staleAt }
    });
    origin.queueSyncManifestResponses({
      status: 'failed',
      errorCode: 'path_conflict',
      errorDetails: { path: 'plugins/a/SKILL.md' }
    });

    await checkSkillRepositoryDrift({ skillRepositoryId: target.repository.id });
    let failedCheck = await db.skillDestinationSync.findFirstOrThrow({
      where: { destinationOid: target.destination.oid, trigger: 'drift_check' }
    });
    expect((await repositoryOf(target)).lastDriftCheckAt).toEqual(staleAt);
    await send(failedCheck);
    expect((await poll(failedCheck)).status).toBe('failed');
    expect((await repositoryOf(target)).lastDriftCheckAt).toEqual(staleAt);

    await db.skillDestinationSyncRepositoryPropagation.update({
      where: { oid: (await propagationOf(failedCheck)).oid },
      data: { status: 'canceled', endReason: 'superseded' }
    });
    origin.queueSyncManifestResponses({ status: 'complete_unmerged' });
    await checkSkillRepositoryDrift({ skillRepositoryId: target.repository.id });
    let check = await db.skillDestinationSync.findFirstOrThrow({
      where: { destinationOid: target.destination.oid, trigger: 'drift_check' },
      orderBy: { oid: 'desc' }
    });
    expect(check.oid).not.toBe(failedCheck.oid);
    await send(check);
    expect((await poll(check)).status).toBe('completed');
    expect((await repositoryOf(target)).lastDriftCheckAt!.getTime()).toBeGreaterThan(
      staleAt.getTime()
    );
  });

  it('shows a rate-limited repository as waiting and completes it once Origin finishes', async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    let nextPollAt = new Date(Date.now() + 10 * 60 * 1000);
    origin.queueSyncManifestResponses({
      status: 'syncing_contents',
      waitingReason: 'rate_limited',
      nextPollAt
    });

    let sync = await startSync(target, manifest);
    let propagation = await send(sync);

    expect(await poll(sync)).toMatchObject({
      status: 'processing',
      waitingReason: 'rate_limited',
      waitingUntil: nextPollAt
    });

    origin.updateSync(propagation.originSyncId!, {
      status: 'merged',
      waitingReason: null,
      nextPollAt: null,
      resultStats: { filesUploaded: 1, rateLimitWaitMs: 600_000 }
    });
    expect(await poll(sync)).toMatchObject({
      status: 'completed',
      waitingReason: null,
      waitingUntil: null,
      resultStats: { filesUploaded: 1, rateLimitWaitMs: 600_000 }
    });
    await eventually(async () => {
      let stored = await db.skillDestinationSync.findUniqueOrThrow({
        where: { oid: sync.oid }
      });
      expect(stored.logs).toEqual(
        expect.arrayContaining([
          [
            expect.any(Number),
            expect.stringContaining(
              `Waiting for the provider rate limit; resumes at ${nextPollAt.toISOString()}`
            )
          ],
          [expect.any(Number), expect.stringContaining('waited 600s for rate limits')]
        ])
      );
    });
  });

  it("shows Origin's provider_unavailable wait with Origin's retry time", async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    let waitingUntil = new Date(Date.now() + 3 * 60 * 1000);
    origin.queueSyncManifestResponses({
      status: 'syncing_contents',
      waitingReason: 'provider_unavailable',
      waitingUntil,
      nextPollAt: new Date(Date.now() + 30 * 60 * 1000),
      errorMessage: 'GitHub returned 502'
    });

    let sync = await startSync(target, manifest);
    await send(sync);

    expect(await poll(sync)).toMatchObject({
      status: 'processing',
      waitingReason: 'provider_unavailable',
      waitingUntil
    });
  });

  it('falls back to nextPollAt and the error code for an Origin without waiting fields', async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    let nextPollAt = new Date(Date.now() + 10 * 60 * 1000);
    origin.queueSyncManifestResponses({
      status: 'syncing_contents',
      errorCode: 'rate_limited',
      errorMessage: 'The repository provider rate limit was reached.',
      nextPollAt,
      omitWaitingFields: true
    });

    let sync = await startSync(target, manifest);
    await send(sync);

    expect(await poll(sync)).toMatchObject({
      status: 'processing',
      waitingReason: 'rate_limited',
      waitingUntil: nextPollAt
    });
  });

  it('fails a path conflict for the user to fix without repairing or rebuilding', async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    origin.queueSyncManifestResponses({
      status: 'failed',
      errorCode: 'path_conflict',
      errorDetails: { path: 'plugins/a/SKILL.md', paths: ['plugins/a'] }
    });

    let sync = await startSync(target, manifest);
    await send(sync);

    expect(await poll(sync)).toMatchObject({
      status: 'failed',
      errorCode: 'path_conflict',
      errorMessage:
        "plugins/a/SKILL.md can't be written because plugins/a in the repository is in the way. Move or remove it there, then sync again."
    });
    expect((await repositoryOf(target)).nextRepairAt).toBeNull();

    await db.skillRepository.update({
      where: { oid: target.repository.oid },
      data: { nextRepairAt: new Date(Date.now() - 1000) }
    });
    await repairSkillRepository({ skillRepositoryId: target.repository.id });
    expect(
      await db.skillDestinationSync.count({
        where: {
          destinationOid: target.destination.oid,
          trigger: { in: ['repair', 'recovery'] }
        }
      })
    ).toBe(0);
  });

  it("retries through the repair cron while Origin's manifest sync kill switch is on", async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    origin.queueSyncManifestResponses({
      rpcError: { status: 409, code: 'manifest_sync_disabled' }
    });

    let sync = await startSync(target, manifest);
    let rejected = await send(sync);

    expect(rejected).toMatchObject({
      status: 'failed',
      errorCode: 'manifest_sync_disabled',
      originSyncId: null
    });
    expect(callsFor(target)).toHaveLength(1);
    let scheduled = await repositoryOf(target);
    expect(scheduled.nextRepairAt!.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    await poll(sync);
    expect(
      (await db.skillDestinationSync.findUniqueOrThrow({ where: { oid: sync.oid } })).status
    ).toBe('failed');

    await db.skillRepository.update({
      where: { oid: target.repository.oid },
      data: { nextRepairAt: new Date(Date.now() - 1000) }
    });
    await repairSkillRepository({ skillRepositoryId: target.repository.id });
    let repair = await db.skillDestinationSync.findFirstOrThrow({
      where: { destinationOid: target.destination.oid, trigger: 'repair' }
    });

    await send(repair);
    expect((await poll(repair)).status).toBe('completed');
    expect(await repositoryOf(target)).toMatchObject({
      lastPropagatedManifestOid: manifest.oid,
      repairAttempts: 0
    });
  });

  it('has the repair cron rebuild only the items whose sources Origin reported missing', async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    let { missingKey, itemHashes, resetHashes } = await seedAppliedItems(target);
    let seededRecoveries = [];
    for (let i = 0; i < 3; i++) {
      seededRecoveries.push(
        await db.skillDestinationSync.create({
          data: {
            id: await ID.generateId('skillDestinationSync'),
            destinationOid: target.destination.oid,
            status: 'completed',
            trigger: 'recovery',
            storageMode: 'manifest',
            completedAt: new Date()
          }
        })
      );
    }
    origin.queueSyncManifestResponses({
      status: 'failed',
      errorCode: 'source_not_found',
      errorDetails: { keys: [missingKey] }
    });

    let sync = await startSync(target, manifest);
    let propagation = await send(sync);
    await poll(sync);
    expect(await itemHashes()).toEqual({ marketplace: 'applied', plugin: 'applied' });
    expect((await repositoryOf(target)).nextRepairAt).not.toBeNull();

    await db.skillDestinationSync.updateMany({
      where: { oid: { in: seededRecoveries.map(recovery => recovery.oid) } },
      data: { createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
    });
    await resetHashes();
    await db.skillRepository.update({
      where: { oid: target.repository.oid },
      data: { nextRepairAt: new Date(Date.now() - 1000) }
    });
    await repairSkillRepository({ skillRepositoryId: target.repository.id });

    expect(
      origin
        .callsTo('scmRepositorySync:getMany')
        .some(call => call.payload.scmRepositorySyncIds.includes(propagation.originSyncId))
    ).toBe(true);
    expect(
      await db.skillDestinationSync.count({
        where: {
          destinationOid: target.destination.oid,
          trigger: 'recovery',
          oid: { gt: sync.oid }
        }
      })
    ).toBe(1);
    expect(await itemHashes()).toEqual({ marketplace: '', plugin: 'applied' });
  });

  it('repairs a retryable failure with backoff in a repository-stage sync', async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    origin.queueSyncManifestResponses({ status: 'failed', errorCode: 'rate_limited' });

    let sync = await startSync(target, manifest);
    await send(sync);
    await poll(sync);

    let scheduled = await repositoryOf(target);
    expect(scheduled.nextRepairAt!.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    expect(scheduled.nextRepairAt!.getTime()).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);

    await repairSkillRepository({ skillRepositoryId: target.repository.id });
    expect(
      await db.skillDestinationSync.count({
        where: { destinationOid: target.destination.oid, trigger: 'repair' }
      })
    ).toBe(0);

    await db.skillRepository.update({
      where: { oid: target.repository.oid },
      data: { nextRepairAt: new Date(Date.now() - 1000) }
    });
    await repairSkillRepository({ skillRepositoryId: target.repository.id });

    let repair = await db.skillDestinationSync.findFirstOrThrow({
      where: { destinationOid: target.destination.oid, trigger: 'repair' }
    });
    expect(repair).toMatchObject({
      isAtRepoSyncStage: true,
      storageMode: 'manifest',
      manifestOid: manifest.oid,
      startedAt: null
    });
    expect(await repositoryOf(target)).toMatchObject({
      repairAttempts: 1,
      nextRepairAt: null
    });
    expect(target.stages.jobs('perform')).toContainEqual({
      skillDestinationSyncId: repair.id,
      processedPropagationIds: [],
      pendingPropagationIds: [(await propagationOf(repair)).id]
    });

    origin.queueSyncManifestResponses({ status: 'failed', errorCode: 'rate_limited' });
    await send(repair);
    await poll(repair);
    let backedOff = await repositoryOf(target);
    expect(backedOff.nextRepairAt!.getTime()).toBeGreaterThan(Date.now() + 59 * 60 * 1000);

    await db.skillRepository.update({
      where: { oid: target.repository.oid },
      data: { nextRepairAt: new Date(Date.now() - 1000) }
    });
    await repairSkillRepository({ skillRepositoryId: target.repository.id });
    let secondRepair = await db.skillDestinationSync.findFirstOrThrow({
      where: { destinationOid: target.destination.oid, trigger: 'repair' },
      orderBy: { oid: 'desc' }
    });
    await send(secondRepair);
    expect((await poll(secondRepair)).status).toBe('completed');
    expect(await repositoryOf(target)).toMatchObject({
      repairAttempts: 0,
      nextRepairAt: null,
      lastPropagatedManifestOid: manifest.oid
    });
  });

  it('retries a sync Origin stopped for making no progress through the repair cron', async () => {
    let target = await setup();
    let manifest = await storeManifest(target, { 'plugins/a/SKILL.md': `# ${uniqueId('a')}` });
    origin.queueSyncManifestResponses({
      status: 'failed',
      errorCode: 'no_progress',
      errorMessage:
        'The repository update made no progress in 10 attempts in a row. Retry the sync.'
    });

    let sync = await startSync(target, manifest);
    await send(sync);

    expect(await poll(sync)).toMatchObject({
      status: 'failed',
      errorCode: 'no_progress',
      errorMessage: 'Sync stopped making progress; Metorial will retry.'
    });
    let scheduled = await repositoryOf(target);
    expect(scheduled.nextRepairAt!.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);

    await db.skillRepository.update({
      where: { oid: target.repository.oid },
      data: { nextRepairAt: new Date(Date.now() - 1000) }
    });
    await repairSkillRepository({ skillRepositoryId: target.repository.id });
    let repair = await db.skillDestinationSync.findFirstOrThrow({
      where: { destinationOid: target.destination.oid, trigger: 'repair' }
    });
    expect(await repositoryOf(target)).toMatchObject({
      repairAttempts: 1,
      nextRepairAt: null
    });

    await send(repair);
    expect((await poll(repair)).status).toBe('completed');
    expect(await repositoryOf(target)).toMatchObject({
      repairAttempts: 0,
      lastPropagatedManifestOid: manifest.oid
    });
  });
});
