import { hashBytes } from '@lowerdeck/hash/content';
import { eventually, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { createResourceAuthorization } from '@metorial/module-access';
import {
  filePurposeService,
  fileService,
  getCargoFilesBucketName,
  getStorage
} from '@metorial/module-file';
import { storeService } from '@metorial/module-store';
import { beforeAll, describe, expect, it } from 'vitest';
import { skillPluginSkillService } from '../src';
import { forceSkillDestinationSync } from '../src/lib/destinationSync';
import { compareManifestPaths } from '../src/lib/manifestFile/pathRules';
import { readStoredManifestFile } from '../src/lib/manifestFile/storage';
import { getSkillSyncBlobKey } from '../src/queues/sync/_lib/blobStore';
import { getSkillDestinationFilePathBytes } from '../src/queues/sync/_lib/manifestRows';
import { readSkillDestinationSnapshotRows } from '../src/queues/sync/snapshot';
import {
  skillSyncBlobGcManyQueue,
  skillSyncObjectSweepManyQueue
} from '../src/queues/sync/storageGc';
import { applyMarketplace } from '../src/serializers/marketplace';
import { applyPlugin } from '../src/serializers/plugin';
import { applySkill } from '../src/serializers/skill';
import {
  addDocument,
  addSkillToPlugin,
  createMarketplace,
  createPlugin,
  createSkill,
  editDocument,
  loadMarketplaceSerializerInput,
  runSerializer,
  useFakeOrigin,
  useSkillsManifestSyncFlag
} from './_fixtures';

let syncTimeout = { timeoutMs: 120_000, intervalMs: 1000 };
let testTimeout = { timeout: 180_000 };
let authorization = createResourceAuthorization({ restricted: false });

let objectExists = async (key: string) =>
  await getStorage()
    .headObject(getCargoFilesBucketName(), key)
    .then(() => true)
    .catch(error => {
      if ((error as { statusCode?: number }).statusCode === 404) return false;
      throw error;
    });

let syncDestination = async (destinationOid: bigint) => {
  let sync = await forceSkillDestinationSync({ destination: { oid: destinationOid } });

  return await eventually(async () => {
    let current = await db.skillDestinationSync.findUniqueOrThrow({
      where: { oid: sync.oid },
      include: { manifest: true }
    });
    expect(current.status).toBe('completed');
    expect(current.manifest).not.toBeNull();
    return { ...current, manifest: current.manifest! };
  }, syncTimeout);
};

let readManifest = async (manifest: {
  objectKey: string;
  sha256: string;
  entryCount: number;
}) =>
  await readStoredManifestFile({
    key: manifest.objectKey,
    sha256: manifest.sha256,
    entryCount: manifest.entryCount
  });

let destinationRows = async (destinationOid: bigint) =>
  new Map(
    (
      await db.skillDestinationFile.findMany({
        where: { destinationOid },
        select: { oid: true, path: true, itemKey: true, sha256: true, updatedAt: true }
      })
    ).map(row => [row.path, row])
  );

let serializerPaths = async (skillMarketplaceId: string) => {
  let input = await loadMarketplaceSerializerInput(skillMarketplaceId);
  let paths = (
    await runSerializer(applyMarketplace, { skillMarketplace: input.skillMarketplace })
  ).paths();

  for (let plugin of input.plugins) {
    paths.push(
      ...(
        await runSerializer(applyPlugin, {
          skillPlugin: plugin.skillPlugin,
          skillMarketplace: input.skillMarketplace,
          skillMarketplacePlugin: plugin.skillMarketplacePlugin
        })
      ).paths()
    );
    for (let skill of plugin.skills) {
      paths.push(...(await runSerializer(applySkill, skill)).paths());
    }
  }

  return paths.sort();
};

let skillDir = (pluginSkill: { pluginSkillSlug: string }) =>
  `/skills/${pluginSkill.pluginSkillSlug}/`;

let addPendingTextFile = async (
  fixture: OrganizationFixture,
  skill: { storeId: string },
  path: string,
  content: string
) => {
  let purpose = await filePurposeService.ensureGenericFilePurpose();
  let file = await fileService.createUploadedFile({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    purpose: purpose.id,
    file: new Blob([content], { type: 'text/plain' }),
    input: { name: path.split('/').at(-1)!, title: path, authorization }
  });

  await storeService.modifyStoreItems({
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    authorization,
    store: await db.store.findUniqueOrThrow({ where: { id: skill.storeId } }),
    operations: [{ type: 'add', path, fileId: file.id }]
  });

  return file;
};

describe('manifest sync pipeline', testTimeout, () => {
  let origin = useFakeOrigin();
  let org = useOrganization();
  useSkillsManifestSyncFlag(true);

  let fixture: OrganizationFixture;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
  });

  it('creates manifest destinations without a code bucket', async () => {
    let bucketCalls = origin.callsTo('codeBucket:create').length;

    let marketplace = await createMarketplace(fixture);
    let plugin = await createPlugin(fixture);

    for (let destinationOid of [marketplace.destinationOid!, plugin.destinationOid!]) {
      let destination = await db.skillDestination.findUniqueOrThrow({
        where: { oid: destinationOid }
      });
      expect(destination).toMatchObject({ storageMode: 'manifest', codeBucketId: null });
    }
    expect(origin.callsTo('codeBucket:create')).toHaveLength(bucketCalls);
  });

  it('pages snapshot rows in manifest path order across non-ASCII paths', async () => {
    let destination = await db.skillDestination.create({
      data: { id: await ID.generateId('skillDestination'), storageMode: 'manifest' }
    });
    let paths = [
      'B.md',
      'a.md',
      'b-c.md',
      'b/c.md',
      'b/z.md',
      'b/ä.md',
      'b/é/a.md',
      'b/中/文.md',
      'b/\uE000.md',
      'b/\uFF21.md',
      'b/😀.md',
      'b/😀x.md',
      'b/𝄞.md',
      'b/~.md',
      '~.md'
    ];
    await db.skillDestinationFile.createMany({
      data: paths.map((path, i) => ({
        destinationOid: destination.oid,
        path,
        pathBytes: i % 2 ? Buffer.from(getSkillDestinationFilePathBytes(path)) : null,
        signature: '',
        gitBlobSha: hashBytes(path).gitBlobSha,
        sha256: hashBytes(path).sha256,
        byteSize: BigInt(path.length),
        crc32: 0n,
        sourceKey: `skill-sync/blobs/sha256/${hashBytes(path).sha256}`
      }))
    });

    let expected = [...paths].sort(compareManifestPaths);
    for (let pageSize of [1, 2, 3, 4, 100]) {
      let read: string[] = [];
      for await (let entry of readSkillDestinationSnapshotRows(destination.oid, pageSize)) {
        read.push(entry.path);
      }
      expect(read, `page size ${pageSize}`).toEqual(expected);
    }

    let rows = await db.skillDestinationFile.findMany({
      where: { destinationOid: destination.oid }
    });
    expect(
      rows
        .filter(
          row =>
            !row.pathBytes ||
            !Buffer.from(row.pathBytes).equals(
              Buffer.from(getSkillDestinationFilePathBytes(row.path))
            )
        )
        .map(row => row.path)
    ).toEqual([]);
  });

  describe('a marketplace with skills', () => {
    let marketplace: Awaited<ReturnType<typeof createMarketplace>>;
    let keptSkill: Awaited<ReturnType<typeof createSkill>>;
    let editedSkill: Awaited<ReturnType<typeof createSkill>>;
    let editedDocumentId: string;
    let keptPluginSkill: Awaited<ReturnType<typeof addSkillToPlugin>>;
    let editedPluginSkill: Awaited<ReturnType<typeof addSkillToPlugin>>;
    let removedPluginSkill: Awaited<ReturnType<typeof addSkillToPlugin>>;
    let pendingContent: string;
    let first: Awaited<ReturnType<typeof syncDestination>>;

    beforeAll(async () => {
      marketplace = await createMarketplace(fixture);
      let plugin = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });

      keptSkill = await createSkill(fixture, { name: uniqueId('Kept') });
      await addDocument(fixture, keptSkill, '/SKILL.md', `# Kept\n\n${keptSkill.id}`);
      await addDocument(fixture, keptSkill, '/references/guide.md', `guide ${keptSkill.id}`);
      pendingContent = `pending ${uniqueId('content')}\n`;
      await addPendingTextFile(fixture, keptSkill, '/references/data.txt', pendingContent);

      editedSkill = await createSkill(fixture, { name: uniqueId('Edited') });
      await addDocument(fixture, editedSkill, '/SKILL.md', `# Edited\n\n${editedSkill.id}`);
      editedDocumentId = (
        await addDocument(fixture, editedSkill, '/references/notes.md', `v1 ${editedSkill.id}`)
      ).id;

      let removedSkill = await createSkill(fixture, { name: uniqueId('Removed') });
      await addDocument(fixture, removedSkill, '/SKILL.md', `# Removed\n\n${removedSkill.id}`);

      keptPluginSkill = await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: keptSkill.id,
        pluginSkillSlug: 'kept'
      });
      editedPluginSkill = await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: editedSkill.id,
        pluginSkillSlug: 'edited'
      });
      removedPluginSkill = await addSkillToPlugin(fixture, {
        skillPluginId: plugin.id,
        skillId: removedSkill.id,
        pluginSkillSlug: 'removed'
      });

      first = await syncDestination(marketplace.destinationOid!);
    }, testTimeout.timeout);

    it('publishes exactly what the serializers write, with downloadable content', async () => {
      let manifest = await readManifest(first.manifest);
      let paths = manifest.entries.map(entry => entry.path);

      expect(paths).toEqual(
        [...paths].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
      );
      expect([...paths].sort()).toEqual(await serializerPaths(marketplace.id));
      expect(manifest.header).toMatchObject({
        destinationId: (
          await db.skillDestination.findUniqueOrThrow({
            where: { oid: marketplace.destinationOid! }
          })
        ).id,
        entryCount: paths.length
      });

      for (let entry of manifest.entries) {
        let object = await getStorage().getObject(getCargoFilesBucketName(), entry.key);
        expect(hashBytes(object.data)).toEqual({
          sha256: entry.sha256,
          gitBlobSha: entry.gitBlobSha,
          crc32: entry.crc32,
          size: entry.size
        });
      }

      let destination = await db.skillDestination.findUniqueOrThrow({
        where: { oid: marketplace.destinationOid! }
      });
      expect(destination.currentManifestOid).toBe(first.manifest.oid);
      expect(first.storageMode).toBe('manifest');
      expect((await destinationRows(marketplace.destinationOid!)).size).toBe(paths.length);
    });

    it('stores pending File content in the blob store', async () => {
      let manifest = await readManifest(first.manifest);
      let path = `${skillDir(keptPluginSkill)}references/data.txt`;
      let entry = manifest.entries.find(entry => entry.path.endsWith(path));

      expect(manifest.entries.map(entry => entry.path)).toContainEqual(
        expect.stringContaining(path)
      );
      expect(entry!.key).toBe(getSkillSyncBlobKey(hashBytes(pendingContent).sha256));
      let object = await getStorage().getObject(getCargoFilesBucketName(), entry!.key);
      expect(Buffer.from(object.data).toString()).toBe(pendingContent);
      expect(await db.skillSyncBlob.findUnique({ where: { key: entry!.key } })).not.toBeNull();
    });

    it('republishes the same manifest when nothing changed', async () => {
      let manifestCount = await db.skillDestinationManifest.count({
        where: { destinationOid: marketplace.destinationOid! }
      });

      let again = await syncDestination(marketplace.destinationOid!);

      expect(again.manifest.oid).toBe(first.manifest.oid);
      expect(again.manifest.sha256).toBe(first.manifest.sha256);
      expect(
        await db.skillDestinationManifest.count({
          where: { destinationOid: marketplace.destinationOid! }
        })
      ).toBe(manifestCount);
    });

    it('rewrites only the rows of the item that changed', async () => {
      let before = await destinationRows(marketplace.destinationOid!);

      await editDocument(fixture, editedDocumentId, `v2 ${editedSkill.id}`);
      let edited = await syncDestination(marketplace.destinationOid!);

      let after = await destinationRows(marketplace.destinationOid!);
      let changed = [...after.values()].filter(row => {
        let previous = before.get(row.path);
        return (
          previous?.oid !== row.oid || previous.updatedAt.getTime() !== row.updatedAt.getTime()
        );
      });

      expect(edited.manifest.oid).not.toBe(first.manifest.oid);
      expect(changed.map(row => row.path)).toEqual([
        expect.stringContaining(`${skillDir(editedPluginSkill)}references/notes.md`)
      ]);
      expect(changed[0]!.sha256).toBe(hashBytes(`v2 ${editedSkill.id}`).sha256);
      expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
    });

    it('removes the paths of a skill that left the plugin', async () => {
      await skillPluginSkillService.removeSkillPluginSkill({
        project: fixture.project,
        instance: fixture.instance,
        skillPluginSkill: await skillPluginSkillService.getSkillPluginSkillById({
          project: fixture.project,
          instance: fixture.instance,
          skillPluginSkillId: removedPluginSkill.id
        })
      });

      let removed = await syncDestination(marketplace.destinationOid!);

      let paths = (await readManifest(removed.manifest)).entries.map(entry => entry.path);
      expect(paths.filter(path => path.includes(skillDir(removedPluginSkill)))).toEqual([]);
      expect(paths).toContainEqual(
        expect.stringContaining(`${skillDir(keptPluginSkill)}SKILL.md`)
      );
      expect(
        [...(await destinationRows(marketplace.destinationOid!)).keys()].some(path =>
          path.includes(skillDir(removedPluginSkill))
        )
      ).toBe(false);
    });

    it('collects unreferenced blobs and orphaned objects with zero retention', async () => {
      let orphanContent = `orphan ${uniqueId('blob')}`;
      let orphanBlobKey = getSkillSyncBlobKey(hashBytes(orphanContent).sha256);
      await db.skillSyncBlob.create({
        data: {
          key: orphanBlobKey,
          sha256: hashBytes(orphanContent).sha256,
          gitBlobSha: hashBytes(orphanContent).gitBlobSha,
          crc32: BigInt(hashBytes(orphanContent).crc32),
          byteSize: BigInt(orphanContent.length)
        }
      });
      await getStorage().putObject(getCargoFilesBucketName(), orphanBlobKey, orphanContent);

      let untrackedContent = `untracked ${uniqueId('blob')}`;
      let untrackedBlobKey = getSkillSyncBlobKey(hashBytes(untrackedContent).sha256);
      await getStorage().putObject(
        getCargoFilesBucketName(),
        untrackedBlobKey,
        untrackedContent
      );

      let destination = await db.skillDestination.findUniqueOrThrow({
        where: { oid: marketplace.destinationOid! },
        include: { currentManifest: true }
      });
      let untrackedManifestKey = `skill-sync/manifests/${destination.id}/${'0'.repeat(64)}.ndjson`;
      await getStorage().putObject(getCargoFilesBucketName(), untrackedManifestKey, 'stray');

      let liveKeys = (await readManifest(destination.currentManifest!)).entries.map(
        entry => entry.key
      );

      await skillSyncBlobGcManyQueue.add({ retentionSeconds: 0 });
      await skillSyncObjectSweepManyQueue.add({
        prefix: untrackedBlobKey,
        retentionSeconds: 0
      });
      await skillSyncObjectSweepManyQueue.add({
        prefix: `skill-sync/manifests/${destination.id}/`,
        retentionSeconds: 0
      });

      await eventually(async () => {
        expect(
          await db.skillSyncBlob.findUnique({ where: { key: orphanBlobKey } })
        ).toBeNull();
        expect(await objectExists(orphanBlobKey)).toBe(false);
        expect(await objectExists(untrackedBlobKey)).toBe(false);
        expect(await objectExists(untrackedManifestKey)).toBe(false);
      }, syncTimeout);

      expect(await objectExists(destination.currentManifest!.objectKey)).toBe(true);
      for (let key of liveKeys) {
        expect(await objectExists(key)).toBe(true);
      }
    });
  });
});

describe('legacy code-bucket sync', testTimeout, () => {
  let origin = useFakeOrigin();
  let org = useOrganization();
  useSkillsManifestSyncFlag(false);

  it('keeps creating code buckets and never snapshots a manifest', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let marketplace = await createMarketplace(fixture);
    let plugin = await createPlugin(fixture, {}, { skillMarketplaceId: marketplace.id });
    let skill = await createSkill(fixture);
    await addDocument(fixture, skill, '/SKILL.md', `# Legacy\n\n${skill.id}`);
    await addSkillToPlugin(fixture, { skillPluginId: plugin.id, skillId: skill.id });

    let destination = await db.skillDestination.findUniqueOrThrow({
      where: { oid: marketplace.destinationOid! }
    });
    expect(destination.storageMode).toBe('code_bucket');
    expect(origin.bucketCreation(destination.codeBucketId)).toBeDefined();

    let sync = await forceSkillDestinationSync({ destination });

    await eventually(async () => {
      let current = await db.skillDestinationSync.findUniqueOrThrow({
        where: { oid: sync.oid }
      });
      expect(current.startedAt).not.toBeNull();
      expect(current.storageMode).toBe('code_bucket');
      expect(current.prDescription).toContain(`- Add plugin ${plugin.name}`);
    }, syncTimeout);

    expect(
      await db.skillDestinationSync.findUniqueOrThrow({ where: { oid: sync.oid } })
    ).toMatchObject({
      manifestOid: null
    });
    expect(
      await db.skillDestinationManifest.count({ where: { destinationOid: destination.oid } })
    ).toBe(0);
  });
});
