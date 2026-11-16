import { hashBytes } from '@lowerdeck/hash/content';
import { eventually, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { defaultFlags, setFlagProvider } from '@metorial/module-flags';
import { getCargoFilesBucketName, getStorage } from '@metorial/module-file';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { managedSkillPluginService, skillExportService } from '../src';
import { readStoredManifestFile } from '../src/lib/manifestFile/storage';
import {
  addDocument,
  addSkillToPlugin,
  createMarketplace,
  createPlugin,
  createSkill,
  editDocument,
  useFakeOrigin
} from './_fixtures';
import { readZipArchive } from './_zip';

let exportTimeout = { timeoutMs: 120_000, intervalMs: 1000 };

describe('manifest-mode zip exports', () => {
  let origin = useFakeOrigin();
  let org = useOrganization();

  let fixture: OrganizationFixture;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
  });

  afterEach(() => {
    setFlagProvider(async () => defaultFlags);
  });

  let useManifestMode = async (destinationOid: bigint) =>
    await db.skillDestination.update({
      where: { oid: destinationOid },
      data: { storageMode: 'manifest', storageModeChangedAt: new Date() }
    });

  let createMarketplaceWithSkill = async () => {
    let skill = await createSkill(fixture, { name: uniqueId('Export Skill') });
    await addDocument(fixture, skill, '/SKILL.md', `# Export\n\n${skill.id}`);
    let reference = await addDocument(fixture, skill, '/references/notes.md', 'first draft');
    await addDocument(fixture, skill, '/scripts/run.sh', 'echo hi');

    let marketplace = await createMarketplace(fixture);
    let plugin = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });
    await addSkillToPlugin(fixture, {
      skillPluginId: plugin.id,
      skillId: skill.id,
      pluginSkillSlug: 'export-skill'
    });

    await useManifestMode(marketplace.destinationOid!);

    return { skill, marketplace, plugin, referenceDocumentId: reference.id };
  };

  let exportMarketplace = async (skillMarketplaceId: string) =>
    await skillExportService.createSkillExport({
      project: fixture.project,
      instance: fixture.instance,
      input: { target: 'marketplace', skillMarketplaceId }
    });

  let waitForExport = async (skillExportId: string) => {
    await eventually(async () => {
      let stored = await db.skillExport.findUniqueOrThrow({ where: { id: skillExportId } });
      expect(stored.status).not.toBe('pending');
    }, exportTimeout);

    return await db.skillExport.findUniqueOrThrow({
      where: { id: skillExportId },
      include: { file: true, exportRef: { include: { fileManifest: true } } }
    });
  };

  let readArchive = async (storeId: string) => {
    let object = await getStorage().getObject(getCargoFilesBucketName(), storeId);
    return readZipArchive(object.data);
  };

  let expectArchiveMatchesManifest = async (d: {
    storeId: string;
    manifest: { objectKey: string; sha256: string; entryCount: number };
  }) => {
    let manifest = await readStoredManifestFile({
      key: d.manifest.objectKey,
      sha256: d.manifest.sha256,
      entryCount: d.manifest.entryCount
    });
    let archive = await readArchive(d.storeId);

    expect(archive.map(entry => entry.path)).toEqual(
      manifest.entries.map(entry => entry.path)
    );

    for (let [index, entry] of manifest.entries.entries()) {
      let archived = archive[index]!;
      let source = await getStorage().getObject(getCargoFilesBucketName(), entry.key);

      expect(archived.data.equals(source.data)).toBe(true);
      expect(hashBytes(archived.data)).toEqual({
        sha256: entry.sha256,
        gitBlobSha: entry.gitBlobSha,
        crc32: entry.crc32,
        size: entry.size
      });
      expect(archived.crc32).toBe(entry.crc32);
    }

    return { manifest, archive };
  };

  describe('marketplace exports', () => {
    let setup: Awaited<ReturnType<typeof createMarketplaceWithSkill>>;
    let firstExport: Awaited<ReturnType<typeof waitForExport>>;

    beforeAll(async () => {
      setup = await createMarketplaceWithSkill();
    });

    it('builds the archive with an object-storage zip job from the manifest', async () => {
      let created = await exportMarketplace(setup.marketplace.id);

      firstExport = await waitForExport(created.id);
      expect(firstExport).toMatchObject({
        status: 'completed',
        zipJobId: `skill-export-${created.id}`,
        renamedEntries: null
      });
      expect(firstExport.file).toMatchObject({
        storeId: `skill-exports/${created.id}.zip`,
        fileType: 'application/zip',
        status: 'active'
      });
      expect(firstExport.exportRef.fileManifest).not.toBeNull();
      expect(firstExport.exportRef.fileDestinationTag).toBeNull();

      let { manifest } = await expectArchiveMatchesManifest({
        storeId: firstExport.file!.storeId,
        manifest: firstExport.exportRef.fileManifest!
      });
      expect(manifest.entries.map(entry => entry.path)).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^plugins\/[^/]+\/skills\/export-skill\/SKILL\.md$/),
          expect.stringMatching(
            /^plugins\/[^/]+\/skills\/export-skill\/references\/notes\.md$/
          ),
          expect.stringMatching(/^plugins\/[^/]+\/skills\/export-skill\/scripts\/run\.sh$/)
        ])
      );
    });

    it('reuses the archive while the manifest is unchanged', async () => {
      let created = await exportMarketplace(setup.marketplace.id);
      let reused = await waitForExport(created.id);

      expect(reused).toMatchObject({
        status: 'completed',
        fileOid: firstExport.fileOid,
        zipJobId: null
      });
      expect(reused.exportRef.fileManifestOid).toBe(firstExport.exportRef.fileManifestOid);
    });

    it('builds a new archive after the content changed', async () => {
      await editDocument(fixture, setup.referenceDocumentId, 'second draft');
      await db.skillDestination.update({
        where: { oid: setup.marketplace.destinationOid! },
        data: { isDirty: true }
      });

      let created = await exportMarketplace(setup.marketplace.id);
      let rebuilt = await waitForExport(created.id);

      expect(rebuilt).toMatchObject({
        status: 'completed',
        zipJobId: `skill-export-${created.id}`
      });
      expect(rebuilt.fileOid).not.toBe(firstExport.fileOid);
      expect(rebuilt.exportRef.fileManifestOid).not.toBe(
        firstExport.exportRef.fileManifestOid
      );

      let { archive } = await expectArchiveMatchesManifest({
        storeId: rebuilt.file!.storeId,
        manifest: rebuilt.exportRef.fileManifest!
      });
      let notes = archive.find(entry => entry.path.endsWith('/references/notes.md'));
      expect(notes?.data.toString('utf8')).toBe('second draft');
    });

    it('completes while the repository stage waits for review', async () => {
      let destination = await db.skillDestination.findUniqueOrThrow({
        where: { oid: setup.marketplace.destinationOid! },
        include: { currentManifest: true }
      });
      let manifest = destination.currentManifest!;

      let sync = await db.skillDestinationSync.create({
        data: {
          id: await ID.generateId('skillDestinationSync'),
          status: 'waiting_for_review',
          isAtRepoSyncStage: true,
          storageMode: 'manifest',
          destinationOid: destination.oid,
          manifestOid: manifest.oid,
          startedAt: new Date()
        }
      });

      let exportRef = await db.skillExportRef.update({
        where: { oid: firstExport.exportRefOid },
        data: { fileManifestOid: null }
      });
      let pending = await db.skillExport.create({
        data: {
          id: await ID.generateId('skillExport'),
          target: 'marketplace',
          status: 'pending',
          exportRefOid: exportRef.oid,
          projectOid: fixture.project.oid,
          instanceOid: fixture.instance.oid
        }
      });

      await skillExportService.processSkillExport({
        project: fixture.project,
        instance: fixture.instance,
        skillExportId: pending.id,
        skillDestinationSyncId: sync.id
      });

      let completed = await waitForExport(pending.id);
      expect(completed).toMatchObject({
        status: 'completed',
        zipJobId: `skill-export-${pending.id}`
      });
      expect(completed.exportRef.fileManifestOid).toBe(manifest.oid);

      await expectArchiveMatchesManifest({
        storeId: completed.file!.storeId,
        manifest
      });
    });
  });

  describe('missing sources', () => {
    let exportWithMissingSkillFile = async () => {
      let setup = await createMarketplaceWithSkill();
      let first = await waitForExport((await exportMarketplace(setup.marketplace.id)).id);
      expect(first.status).toBe('completed');

      let manifest = await readStoredManifestFile({
        key: first.exportRef.fileManifest!.objectKey,
        sha256: first.exportRef.fileManifest!.sha256,
        entryCount: first.exportRef.fileManifest!.entryCount
      });
      let skillFile = manifest.entries.find(entry => entry.path.endsWith('/SKILL.md'))!;
      await getStorage().deleteObject(getCargoFilesBucketName(), skillFile.key);
      await db.skillExportRef.update({
        where: { oid: first.exportRefOid },
        data: { fileManifestOid: null }
      });

      return { setup, first, missingKey: skillFile.key };
    };

    it('rebuilds the affected items and retries the zip job', async () => {
      let { setup, missingKey } = await exportWithMissingSkillFile();
      let destinationOid = setup.marketplace.destinationOid!;

      let created = await exportMarketplace(setup.marketplace.id);
      let completed = await waitForExport(created.id);

      expect(completed).toMatchObject({
        status: 'completed',
        zipJobId: `skill-export-${created.id}-retry`
      });
      let recoveries = await db.skillDestinationSync.findMany({
        where: { destinationOid, trigger: 'recovery' }
      });
      expect(recoveries).toHaveLength(1);
      await expect(
        getStorage().headObject(getCargoFilesBucketName(), missingKey)
      ).resolves.toBeDefined();

      await expectArchiveMatchesManifest({
        storeId: completed.file!.storeId,
        manifest: completed.exportRef.fileManifest!
      });
    });

    it('fails without an archive once the recovery limit is reached', async () => {
      let { setup, first } = await exportWithMissingSkillFile();
      let destinationOid = setup.marketplace.destinationOid!;

      for (let i = 0; i < 3; i++) {
        await db.skillDestinationSync.create({
          data: {
            id: await ID.generateId('skillDestinationSync'),
            status: 'completed',
            trigger: 'recovery',
            storageMode: 'manifest',
            destinationOid,
            manifestOid: first.exportRef.fileManifest!.oid,
            startedAt: new Date(),
            completedAt: new Date()
          }
        });
      }

      let created = await exportMarketplace(setup.marketplace.id);
      let failed = await waitForExport(created.id);

      expect(failed).toMatchObject({
        status: 'failed',
        zipJobId: `skill-export-${created.id}`,
        fileOid: null
      });
      expect(
        await db.skillDestinationSync.count({ where: { destinationOid, trigger: 'recovery' } })
      ).toBe(3);
      await expect(
        getStorage().headObject(getCargoFilesBucketName(), `skill-exports/${created.id}.zip`)
      ).rejects.toThrow();
    });
  });

  it('keeps the managed plugin layout for single-skill exports', async () => {
    let skill = await createSkill(fixture, { name: uniqueId('Single Skill') });
    await addDocument(fixture, skill, '/SKILL.md', `# Single\n\n${skill.id}`);
    await addDocument(fixture, skill, '/references/a.md', 'a');

    let managed = await managedSkillPluginService.ensureManagedSkillPlugin({
      project: fixture.project,
      instance: fixture.instance,
      skillId: skill.id
    });
    await useManifestMode(managed.skillPlugin.destinationOid!);

    let created = await skillExportService.createSkillExport({
      project: fixture.project,
      instance: fixture.instance,
      input: { target: 'skill', skillId: skill.id }
    });
    let completed = await waitForExport(created.id);

    expect(completed.status).toBe('completed');
    expect(completed.file?.fileName).toBe(`${managed.skillPlugin.slug}.zip`);

    let { manifest } = await expectArchiveMatchesManifest({
      storeId: completed.file!.storeId,
      manifest: completed.exportRef.fileManifest!
    });
    let skillPaths = manifest.entries
      .map(entry => entry.path)
      .filter(path => path.endsWith('/SKILL.md') || path.endsWith('/references/a.md'));
    expect(skillPaths).toHaveLength(2);
    expect(skillPaths.every(path => path.startsWith('skills/'))).toBe(true);
  });

  it('keeps the code-bucket export for legacy destinations', async () => {
    setFlagProvider(async () => ({ ...defaultFlags, 'skills-manifest-sync': false }));

    let marketplace = await createMarketplace(fixture);
    let destination = await db.skillDestination.findUniqueOrThrow({
      where: { oid: marketplace.destinationOid! }
    });
    expect(destination.storageMode).toBe('code_bucket');
    expect(origin.bucketCreation(destination.codeBucketId)).toBeDefined();

    let created = await exportMarketplace(marketplace.id);

    await eventually(async () => {
      let syncs = await db.skillDestinationSync.findMany({
        where: { destinationOid: destination.oid, createdAt: { gte: created.createdAt } }
      });
      expect(syncs.length).toBeGreaterThan(0);
      expect(syncs.every(sync => sync.storageMode === 'code_bucket')).toBe(true);
    }, exportTimeout);

    let stored = await db.skillExport.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.zipJobId).toBeNull();
    expect(stored.status).not.toBe('completed');
    await expect(
      getStorage().headObject(getCargoFilesBucketName(), `skill-exports/${created.id}.zip`)
    ).rejects.toThrow();
  });
});
