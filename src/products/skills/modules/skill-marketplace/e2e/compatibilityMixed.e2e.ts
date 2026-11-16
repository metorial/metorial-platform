import { eventually, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { applyEnabledFlags, defaultFlags, setFlagProvider } from '@metorial/module-flags';
import { beforeAll, describe, expect, it } from 'vitest';
import { skillMarketplaceRepositoryService, skillPluginRepositoryService } from '../src';
import { forceSkillDestinationSync } from '../src/lib/destinationSync';
import {
  deleteMigratedSkillDestinationCodeBucket,
  migrateSkillDestinationToManifest
} from '../src/queues/storage';
import { useFakeCodeBucket } from './_codeBucket';
import {
  expectSameFiles,
  readManifestFiles,
  rowPath,
  settleDestination,
  sortedPaths,
  syncDestination,
  syncTimeout
} from './_compatibility';
import {
  addDocument,
  addSkillToPlugin,
  createMarketplace,
  createPlugin,
  createSkill,
  editDocument,
  useFakeOrigin,
  useSkillsManifestSyncFlag,
  useStackOriginProxy
} from './_fixtures';

let day = 24 * 60 * 60 * 1000;

describe('legacy and manifest destinations in one instance', { timeout: 600_000 }, () => {
  let origin = useFakeOrigin();
  useStackOriginProxy(origin);
  let codeBucket = useFakeCodeBucket();
  useSkillsManifestSyncFlag(false);
  let org = useOrganization();

  let fixture: OrganizationFixture;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
  });

  let withManifestFlag = async <T>(fn: () => Promise<T>) => {
    let stackFlags = applyEnabledFlags(defaultFlags, process.env.METORIAL_ENABLED_FLAGS);
    setFlagProvider(async () => ({ ...stackFlags, 'skills-manifest-sync': true }));
    try {
      return await fn();
    } finally {
      setFlagProvider(async () => ({ ...stackFlags, 'skills-manifest-sync': false }));
    }
  };

  let loadDestination = async (destinationOid: bigint) =>
    await db.skillDestination.findUniqueOrThrow({ where: { oid: destinationOid } });

  let migrateWhenReady = async (destinationId: string) =>
    await eventually(async () => {
      expect(
        await migrateSkillDestinationToManifest({ destinationId, requestedBy: 'ops' })
      ).toEqual({ status: 'migrated' });
    }, syncTimeout);

  let createLegacyMarketplace = async (skill: Awaited<ReturnType<typeof createSkill>>) => {
    let marketplace = await createMarketplace(fixture);
    let plugin = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });
    let link = await addSkillToPlugin(fixture, {
      skillPluginId: plugin.id,
      skillId: skill.id,
      pluginSkillSlug: 'shared'
    });
    let repoId = origin.addRepository({ owner: 'acme', name: uniqueId('legacy') });
    await skillMarketplaceRepositoryService.createSkillMarketplaceRepository({
      project: fixture.project,
      instance: fixture.instance,
      skillMarketplaceId: marketplace.id,
      repoId
    });
    let destination = await loadDestination(marketplace.destinationOid!);
    expect(destination.storageMode).toBe('code_bucket');
    let repository = await db.skillRepository.findUniqueOrThrow({ where: { repoId } });

    return {
      marketplace,
      plugin,
      destination,
      repoId,
      repository,
      slug: link.pluginSkillSlug
    };
  };

  it('keeps a legacy marketplace and a manifest plugin sharing a skill apart while they sync concurrently', async () => {
    let skill = await createSkill(fixture, { name: uniqueId('Shared') });
    await addDocument(fixture, skill, '/SKILL.md', `# Shared\n\n${skill.id}`);
    let reference = await addDocument(fixture, skill, '/references/shared.md', 'shared v1');

    let legacy = await createLegacyMarketplace(skill);

    let manifestPlugin = await withManifestFlag(async () => await createPlugin(fixture));
    let manifestLink = await addSkillToPlugin(fixture, {
      skillPluginId: manifestPlugin.id,
      skillId: skill.id,
      pluginSkillSlug: 'shared'
    });
    let manifestDestination = await loadDestination(manifestPlugin.destinationOid!);
    expect(manifestDestination.storageMode).toBe('manifest');

    await expect(
      skillPluginRepositoryService.createSkillPluginRepository({
        project: fixture.project,
        instance: fixture.instance,
        skillPluginId: manifestPlugin.id,
        repoId: legacy.repoId
      })
    ).rejects.toThrow();

    let manifestRepoId = origin.addRepository({ owner: 'acme', name: uniqueId('manifest') });
    await skillPluginRepositoryService.createSkillPluginRepository({
      project: fixture.project,
      instance: fixture.instance,
      skillPluginId: manifestPlugin.id,
      repoId: manifestRepoId
    });
    let manifestRepository = await db.skillRepository.findUniqueOrThrow({
      where: { repoId: manifestRepoId }
    });

    await settleDestination(legacy.destination.oid);
    await settleDestination(manifestDestination.oid);

    let edit = `shared v2 ${uniqueId('edit')}`;
    await editDocument(fixture, reference.id, edit);
    let [legacyStart, manifestStart] = await Promise.all([
      forceSkillDestinationSync({ destination: legacy.destination }),
      forceSkillDestinationSync({ destination: manifestDestination })
    ]);
    let [legacySync, manifestSync] = await Promise.all([
      settleDestination(legacy.destination.oid, legacyStart.oid),
      settleDestination(manifestDestination.oid, manifestStart.oid)
    ]);

    expect(legacySync).toMatchObject({ storageMode: 'code_bucket', manifestOid: null });
    expect(manifestSync).toMatchObject({ storageMode: 'manifest' });

    let legacyFiles = codeBucket.files(legacy.destination.codeBucketId);
    let legacyMembership = await db.skillMarketplacePlugin.findFirstOrThrow({
      where: { skillPluginOid: legacy.plugin.oid }
    });
    expect(
      legacyFiles
        .get(
          `plugins/${legacyMembership.pluginSlug}/skills/${legacy.slug}/references/shared.md`
        )!
        .toString()
    ).toBe(edit);
    expect(
      sortedPaths(legacyFiles).filter(
        path => !path.startsWith('plugins/') && !path.endsWith('/marketplace.json')
      )
    ).toEqual([]);

    let manifest = await readManifestFiles(manifestSync.manifest!);
    expect(
      manifest.files
        .get(`skills/${manifestLink.pluginSkillSlug}/references/shared.md`)!
        .toString()
    ).toBe(edit);
    expect(sortedPaths(manifest.files).filter(path => path.startsWith('plugins/'))).toEqual(
      []
    );
    expect(
      (
        await db.skillDestinationFile.findMany({
          where: { destinationOid: legacy.destination.oid }
        })
      )
        .map(rowPath)
        .sort()
    ).toEqual(sortedPaths(legacyFiles));
    expect(
      (
        await db.skillDestinationFile.findMany({
          where: { destinationOid: manifestDestination.oid }
        })
      )
        .map(rowPath)
        .sort()
    ).toEqual(sortedPaths(manifest.files));

    let codeBucketSyncs = origin.callsTo('scmRepository:syncCodeBucket');
    let manifestSyncs = origin.syncManifestCalls();
    expect(
      codeBucketSyncs.filter(call => call.payload.scmRepositoryId === manifestRepoId)
    ).toEqual([]);
    expect(
      codeBucketSyncs
        .filter(call => call.payload.scmRepositoryId === legacy.repoId)
        .every(call => call.payload.codeBucketId === legacy.destination.codeBucketId)
    ).toBe(true);
    expect(
      manifestSyncs.filter(
        call =>
          call.payload.scmRepositoryId === legacy.repoId ||
          call.payload.sourceKey === legacy.destination.id
      )
    ).toEqual([]);
    expect(
      manifestSyncs
        .filter(call => call.payload.scmRepositoryId === manifestRepoId)
        .every(call => call.payload.sourceKey === manifestDestination.id)
    ).toBe(true);

    let propagationRepos = async (syncOid: bigint) =>
      (
        await db.skillDestinationSyncRepositoryPropagation.findMany({
          where: { skillDestinationSyncOid: syncOid },
          select: { skillRepositoryOid: true, status: true, manifestOid: true }
        })
      ).map(propagation => ({
        ...propagation,
        manifestOid: propagation.manifestOid !== null
      }));
    expect(await propagationRepos(legacySync.oid)).toEqual([
      { skillRepositoryOid: legacy.repository.oid, status: 'completed', manifestOid: false }
    ]);
    expect(await propagationRepos(manifestSync.oid)).toEqual([
      { skillRepositoryOid: manifestRepository.oid, status: 'completed', manifestOid: true }
    ]);
    expect(
      await db.skillRepository.findUniqueOrThrow({ where: { oid: legacy.repository.oid } })
    ).toMatchObject({ lastPropagatedManifestOid: null });
    expect(
      await db.skillRepository.findUniqueOrThrow({ where: { oid: manifestRepository.oid } })
    ).toMatchObject({ lastPropagatedManifestOid: manifestSync.manifestOid });
  });

  it('skips repository updates for automatic legacy syncs that change nothing', async () => {
    let skill = await createSkill(fixture, { name: uniqueId('Unchanged') });
    await addDocument(fixture, skill, '/SKILL.md', `# Unchanged\n\n${skill.id}`);
    let reference = await addDocument(fixture, skill, '/references/unchanged.md', 'v1');
    let legacy = await createLegacyMarketplace(skill);
    await settleDestination(legacy.destination.oid);

    let codeBucketSyncCount = () =>
      origin
        .callsTo('scmRepository:syncCodeBucket')
        .filter(call => call.payload.scmRepositoryId === legacy.repoId).length;
    let propagationsOf = async (syncOid: bigint) =>
      await db.skillDestinationSyncRepositoryPropagation.findMany({
        where: { skillDestinationSyncOid: syncOid }
      });
    let delivered = codeBucketSyncCount();
    expect(delivered).toBeGreaterThan(0);

    let unchanged = await syncDestination(legacy.destination.oid);
    expect(unchanged.trigger).toBe('automatic');
    expect(await propagationsOf(unchanged.oid)).toEqual([]);
    expect((unchanged.logs as [number, string][]).map(([, message]) => message)).toContain(
      'No content changed and every repository is already up to date; skipping repository updates.'
    );
    expect(codeBucketSyncCount()).toBe(delivered);

    let manual = await forceSkillDestinationSync({
      destination: legacy.destination,
      trigger: 'manual'
    });
    await settleDestination(legacy.destination.oid, manual.oid);
    expect(await propagationsOf(manual.oid)).toMatchObject([{ status: 'completed' }]);

    await editDocument(fixture, reference.id, `v2 ${skill.id}`);
    let revisionBefore = (await loadDestination(legacy.destination.oid)).contentRevision;
    let edited = await syncDestination(legacy.destination.oid);
    let destination = await loadDestination(legacy.destination.oid);
    expect(destination.contentRevision).toBeGreaterThan(revisionBefore);
    expect(await propagationsOf(edited.oid)).toMatchObject([
      { status: 'completed', contentRevision: destination.contentRevision }
    ]);
  });

  it('skips repository updates for automatic manifest syncs that change nothing', async () => {
    let skill = await createSkill(fixture, { name: uniqueId('Unchanged Manifest') });
    await addDocument(fixture, skill, '/SKILL.md', `# Unchanged\n\n${skill.id}`);
    let plugin = await withManifestFlag(async () => await createPlugin(fixture));
    await addSkillToPlugin(fixture, {
      skillPluginId: plugin.id,
      skillId: skill.id,
      pluginSkillSlug: 'unchanged'
    });
    let repoId = origin.addRepository({ owner: 'acme', name: uniqueId('unchanged') });
    await skillPluginRepositoryService.createSkillPluginRepository({
      project: fixture.project,
      instance: fixture.instance,
      skillPluginId: plugin.id,
      repoId
    });
    let first = await settleDestination(plugin.destinationOid!);
    expect(first.storageMode).toBe('manifest');

    let manifestCallCount = () =>
      origin.syncManifestCalls().filter(call => call.payload.scmRepositoryId === repoId)
        .length;
    let delivered = manifestCallCount();
    expect(delivered).toBeGreaterThan(0);

    let unchanged = await syncDestination(plugin.destinationOid!);
    expect(unchanged.manifestOid).toBe(first.manifestOid);
    expect(
      await db.skillDestinationSyncRepositoryPropagation.findMany({
        where: { skillDestinationSyncOid: unchanged.oid }
      })
    ).toEqual([]);
    expect((unchanged.logs as [number, string][]).map(([, message]) => message)).toContain(
      'No content changed and every repository is already up to date; skipping repository updates.'
    );
    expect(manifestCallCount()).toBe(delivered);
  });

  it('migrates legacy rows written before item keys existed', async () => {
    let skill = await createSkill(fixture, { name: uniqueId('Old Rows') });
    await addDocument(fixture, skill, '/SKILL.md', `# Old\n\n${skill.id}`);
    await addDocument(fixture, skill, '/references/old.md', `old ${skill.id}`);
    let legacy = await createLegacyMarketplace(skill);
    await syncDestination(legacy.destination.oid);

    await db.skillDestinationFile.updateMany({
      where: { destinationOid: legacy.destination.oid },
      data: { itemKey: null }
    });
    let legacyFiles = codeBucket.files(legacy.destination.codeBucketId);

    await migrateWhenReady(legacy.destination.id);
    let migrationSync = await db.skillDestinationSync.findFirstOrThrow({
      where: { destinationOid: legacy.destination.oid, trigger: 'migration' }
    });
    let settled = await settleDestination(legacy.destination.oid, migrationSync.oid);
    let manifest = await readManifestFiles(settled.manifest!);

    expectSameFiles(manifest.files, legacyFiles);
    let rows = await db.skillDestinationFile.findMany({
      where: { destinationOid: legacy.destination.oid }
    });
    expect(rows.map(rowPath).sort()).toEqual(sortedPaths(legacyFiles));
    expect(rows.filter(row => !row.itemKey || !row.gitBlobSha).map(rowPath)).toEqual([]);
  });

  it('keeps decomposed unicode paths identical across migration', async () => {
    let skill = await createSkill(fixture, { name: uniqueId('Unicode') });
    await addDocument(fixture, skill, '/SKILL.md', `# Unicode\n\n${skill.id}`);
    await addDocument(fixture, skill, '/references/cafe\u0301.md', 'decomposed');
    let legacy = await createLegacyMarketplace(skill);
    await syncDestination(legacy.destination.oid);
    let legacyFiles = codeBucket.files(legacy.destination.codeBucketId);
    expect(sortedPaths(legacyFiles).some(path => path.includes('caf'))).toBe(true);

    await migrateWhenReady(legacy.destination.id);
    let migrationSync = await db.skillDestinationSync.findFirstOrThrow({
      where: { destinationOid: legacy.destination.oid, trigger: 'migration' }
    });
    let settled = await settleDestination(legacy.destination.oid, migrationSync.oid);
    let manifest = await readManifestFiles(settled.manifest!);

    expectSameFiles(manifest.files, legacyFiles);
  });

  describe('after its repository was relinked from a manifest destination', () => {
    let legacy: Awaited<ReturnType<typeof createLegacyMarketplace>>;

    beforeAll(async () => {
      let skill = await createSkill(fixture, { name: uniqueId('Relinked') });
      await addDocument(fixture, skill, '/SKILL.md', `# Relinked\n\n${skill.id}`);
      legacy = await createLegacyMarketplace(skill);
      await syncDestination(legacy.destination.oid);

      let migratedAt = new Date(Date.now() - 20 * day);
      let completedAt = new Date(Date.now() - 15 * day);
      let previousOwner = await withManifestFlag(async () => await createPlugin(fixture));

      let seedManifestPropagation = async (d: {
        destinationOid: bigint;
        status: 'completed' | 'failed';
      }) => {
        let manifest = await db.skillDestinationManifest.create({
          data: {
            id: await ID.generateId('skillDestinationManifest'),
            sha256: uniqueId('sha'),
            objectKey: `skill-sync/manifests/${uniqueId('seed')}`,
            formatVersion: 1,
            entryCount: 0,
            totalBytes: 0n,
            destinationOid: d.destinationOid
          }
        });
        let sync = await db.skillDestinationSync.create({
          data: {
            id: await ID.generateId('skillDestinationSync'),
            destinationOid: d.destinationOid,
            status: 'completed',
            storageMode: 'manifest',
            manifestOid: manifest.oid,
            completedAt
          }
        });
        await db.skillDestinationSyncRepositoryPropagation.create({
          data: {
            id: await ID.generateId('skillDestinationSyncRepositoryPropagation'),
            status: d.status,
            branchName: uniqueId('metorial-sync'),
            prName: 'Seeded sync',
            manifestOid: manifest.oid,
            skillDestinationSyncOid: sync.oid,
            skillRepositoryOid: legacy.repository.oid,
            completedAt
          }
        });
      };

      await seedManifestPropagation({
        destinationOid: previousOwner.destinationOid!,
        status: 'completed'
      });
      await db.skillDestination.update({
        where: { oid: legacy.destination.oid },
        data: { storageMode: 'manifest', storageModeChangedAt: migratedAt }
      });
      await seedManifestPropagation({
        destinationOid: legacy.destination.oid,
        status: 'failed'
      });
    }, 300_000);

    it("keeps the legacy code bucket until this destination's manifest reached the repository", async () => {
      expect(
        await deleteMigratedSkillDestinationCodeBucket({
          destinationId: legacy.destination.id
        })
      ).toBe(false);
      expect((await loadDestination(legacy.destination.oid)).codeBucketId).toBe(
        legacy.destination.codeBucketId
      );
    });
  });
});
