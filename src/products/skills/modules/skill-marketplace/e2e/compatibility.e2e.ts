import { hashBytes } from '@lowerdeck/hash/content';
import { eventually, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import { hasValidContentHashes } from '@metorial/module-file';
import { beforeAll, describe, expect, it } from 'vitest';
import { skillDestinationStorageService, skillExportService } from '../src';
import { expectedDeletes, scopeContains } from '../src/lib/manifestFile';
import {
  deleteMigratedSkillDestinationCodeBucket,
  migrateSkillDestinationToManifest,
  skillDestinationDeleteCodeBucketManyQueue,
  skillDestinationMigrateStorageManyQueue
} from '../src/queues/storage';
import { useFakeCodeBucket } from './_codeBucket';
import {
  addSkillWithSlug,
  createCompatTarget,
  expectSameFiles,
  readManifestFiles,
  readObjectBytes,
  removePluginSkill,
  rowPath,
  removeStorePath,
  renderDestination,
  settleDestination,
  sortedPaths,
  syncDestination,
  syncTimeout,
  type CompatTarget,
  type DestinationKind
} from './_compatibility';
import {
  addDocument,
  createMarketplace,
  editDocument,
  useFakeOrigin,
  useSkillsManifestSyncFlag,
  useStackOriginProxy
} from './_fixtures';
import { readZipArchive } from './_zip';

let day = 24 * 60 * 60 * 1000;
let lifecycleTimeout = 600_000;

type ManifestFiles = Awaited<ReturnType<typeof readManifestFiles>>;

let lifecycles: {
  kind: DestinationKind;
  migrateVia: 'ops service' | 'cron' | 'direct call';
}[] = [
  { kind: 'marketplace', migrateVia: 'ops service' },
  { kind: 'plugin', migrateVia: 'cron' },
  { kind: 'managed', migrateVia: 'direct call' }
];

let changedPaths = (previous: Map<string, Buffer>, current: Map<string, Buffer>) =>
  [...new Set([...previous.keys(), ...current.keys()])]
    .filter(path => {
      let before = previous.get(path);
      let after = current.get(path);
      return !before || !after || !before.equals(after);
    })
    .sort();

let isUnder = (path: string, base: string) => path.startsWith(`${base}/`);

describe('existing destinations across the manifest migration', () => {
  let origin = useFakeOrigin();
  useStackOriginProxy(origin);
  let codeBucket = useFakeCodeBucket();
  useSkillsManifestSyncFlag(false);
  let org = useOrganization();

  let fixture: OrganizationFixture;

  beforeAll(async () => {
    fixture = await loadOrganizationFixture(org.ids);
  });

  let loadDestination = async (destinationOid: bigint) =>
    await db.skillDestination.findUniqueOrThrow({ where: { oid: destinationOid } });

  let destinationRows = async (destinationOid: bigint) =>
    await db.skillDestinationFile.findMany({
      where: { destinationOid },
      orderBy: { path: 'asc' }
    });

  let latestSyncOid = async (destinationOid: bigint) =>
    (
      await db.skillDestinationSync.findFirst({
        where: { destinationOid },
        orderBy: { oid: 'desc' },
        select: { oid: true }
      })
    )?.oid ?? 0n;

  let manifestCallsFor = (target: CompatTarget) =>
    origin.syncManifestCalls().filter(call => call.payload.sourceKey === target.destinationId);

  let codeBucketSyncsFor = (repoId: string) =>
    origin
      .callsTo('scmRepository:syncCodeBucket')
      .filter(call => call.payload.scmRepositoryId === repoId);

  let syncPropagations = async (syncOid: bigint) =>
    await db.skillDestinationSyncRepositoryPropagation.findMany({
      where: { skillDestinationSyncOid: syncOid },
      include: { skillRepository: true }
    });

  let expectManifestPropagation = async (
    target: CompatTarget,
    syncOid: bigint,
    manifest: { sha256: string },
    previous?: { sha256: string }
  ) => {
    let [propagation, ...others] = await syncPropagations(syncOid);
    expect(others).toEqual([]);
    expect(propagation).toMatchObject({
      status: 'completed',
      skillRepositoryOid: target.repository!.skillRepositoryOid,
      repositoryAccessMode: 'pull_request',
      previousManifestSha256: previous?.sha256 ?? null
    });

    let calls = manifestCallsFor(target).filter(
      call => call.payload.requestKey === propagation!.id
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.payload).toMatchObject({
      scmRepositoryId: target.repository!.repoId,
      sourceKey: target.destinationId,
      manifest: { sha256: manifest.sha256 },
      branchName: propagation!.branchName,
      repositoryAccessMode: 'pull_request',
      allowMassDelete: false,
      deletionGuard: {
        maxUnexpectedDeletes: expect.any(Number),
        maxUnexpectedDeleteRatio: expect.any(Number)
      }
    });
    expect(propagation!.branchName).toMatch(/^metorial-sync-/);
    expect(calls[0]!.payload.previousManifest?.sha256).toBe(previous?.sha256);

    let repository = await db.skillRepository.findUniqueOrThrow({
      where: { oid: target.repository!.skillRepositoryOid },
      include: { lastPropagatedManifest: true }
    });
    expect(repository.lastPropagatedManifest?.sha256).toBe(manifest.sha256);

    return calls[0]!;
  };

  for (let { kind, migrateVia } of lifecycles) {
    describe(`a legacy ${kind}`, { timeout: lifecycleTimeout }, () => {
      let target: CompatTarget;
      let legacyBucketId: string;
      let legacyBucketPurpose: string | undefined;
      let legacyFiles: Map<string, Buffer>;
      let legacyRowPaths: string[];
      let legacyBranchName: string | undefined;
      let bucketCallsAtMigration = 0;
      let codeBucketSyncsAtMigration = 0;
      let current: { sync: { oid: bigint }; manifest: ManifestFiles; row: { sha256: string } };

      let advance = async (expectedChanges: string[], expectedRemovals: string[]) => {
        let before = current;
        let rowsBefore = await destinationRows(target.destinationOid);
        let sync = await syncDestination(target.destinationOid);
        expect(sync).toMatchObject({ storageMode: 'manifest' });

        let manifest = await readManifestFiles(sync.manifest!);
        expect(changedPaths(before.manifest.files, manifest.files)).toEqual(
          [...expectedChanges, ...expectedRemovals].sort()
        );
        expect(
          manifest.entries.every(entry => scopeContains(manifest.header.scope, entry.path))
        ).toBe(true);

        let deletes: string[] = [];
        for await (let path of expectedDeletes(before.manifest.entries, manifest.entries)) {
          deletes.push(path);
        }
        expect(deletes).toEqual([...expectedRemovals].sort());

        let rowsAfter = new Map(
          (await destinationRows(target.destinationOid)).map(row => [rowPath(row), row])
        );
        expect(sortedPaths(rowsAfter)).toEqual(sortedPaths(manifest.files));
        let affected = [target.skillBase, ...expectedChanges, ...expectedRemovals];
        let untouched = rowsBefore.filter(
          row => !affected.some(base => rowPath(row) === base || isUnder(rowPath(row), base))
        );
        expect(untouched.length).toBeGreaterThan(0);
        expect(
          untouched
            .filter(
              row =>
                rowsAfter.get(rowPath(row))?.updatedAt.getTime() !== row.updatedAt.getTime()
            )
            .map(rowPath)
        ).toEqual([]);

        if (target.repository) {
          await expectManifestPropagation(target, sync.oid, sync.manifest!, before.row);
        }

        expect(codeBucket.callsFor(legacyBucketId)).toHaveLength(bucketCallsAtMigration);
        if (target.repository) {
          expect(codeBucketSyncsFor(target.repository.repoId)).toHaveLength(
            codeBucketSyncsAtMigration
          );
        }

        current = { sync, manifest, row: sync.manifest! };
        return manifest;
      };

      beforeAll(async () => {
        target = await createCompatTarget({ fixture, origin, kind });
      }, 300_000);

      it('syncs through the code bucket exactly as the serializers render it', async () => {
        let destination = await loadDestination(target.destinationOid);
        expect(destination).toMatchObject({
          storageMode: 'code_bucket',
          storageModeChangedAt: null,
          codeBucketId: expect.any(String)
        });
        legacyBucketId = destination.codeBucketId!;
        legacyBucketPurpose = origin.bucketCreation(legacyBucketId)?.payload.purpose;
        expect(legacyBucketPurpose).toBe(
          kind === 'managed' ? 'cargo.skill.managed-plugin' : 'cargo.skill.destination'
        );
        let manifestsBefore = await db.skillDestinationManifest.count({
          where: { destinationOid: target.destinationOid }
        });

        let sync = await syncDestination(target.destinationOid);
        expect(sync).toMatchObject({ storageMode: 'code_bucket', manifestOid: null });

        legacyFiles = codeBucket.files(legacyBucketId);
        expect(sortedPaths(legacyFiles)).toEqual([...target.expectedPaths].sort());
        let rendered = await renderDestination(target);
        expectSameFiles(legacyFiles, rendered);
        expect(legacyFiles.get(`${target.skillBase}/assets/legacy.png`)).toEqual(
          target.content.legacy.bytes
        );
        expect(legacyFiles.get(`${target.skillBase}/assets/icon.png`)).toEqual(
          target.content.icon.bytes
        );
        expect(legacyFiles.get(`${target.skillBase}/references/data.txt`)).toEqual(
          target.content.pending.bytes
        );
        expect(codeBucket.writesFor(legacyBucketId).length).toBeGreaterThan(0);

        let rows = await destinationRows(target.destinationOid);
        legacyRowPaths = rows.map(rowPath).sort();
        expect(legacyRowPaths).toEqual(sortedPaths(legacyFiles));
        expect(
          rows
            .filter(
              row =>
                row.signature.startsWith('git:') ||
                row.gitBlobSha !== null ||
                row.sha256 !== null ||
                row.byteSize !== null ||
                row.crc32 !== null ||
                row.sourceKind !== null ||
                row.sourceKey !== null ||
                row.sourceFileOid !== null
            )
            .map(row => row.path)
        ).toEqual([]);

        expect(
          await db.skillDestinationManifest.count({
            where: { destinationOid: target.destinationOid }
          })
        ).toBe(manifestsBefore);
        expect(manifestCallsFor(target)).toEqual([]);
        let contentShas = [...rendered]
          .filter(([path]) => !path.endsWith('assets/logo.svg'))
          .map(([, bytes]) => hashBytes(bytes).sha256);
        expect(await db.skillSyncBlob.count({ where: { sha256: { in: contentShas } } })).toBe(
          0
        );

        if (target.repository) {
          let calls = codeBucketSyncsFor(target.repository.repoId);
          expect(calls.length).toBeGreaterThan(0);
          expect(
            calls.every(
              call =>
                call.payload.codeBucketId === legacyBucketId &&
                call.payload.explicitDeletesOnly === true
            )
          ).toBe(true);

          expect(await syncPropagations(sync.oid)).toEqual([]);
          let destination = await loadDestination(target.destinationOid);
          let propagation = await db.skillDestinationSyncRepositoryPropagation.findFirst({
            where: { skillRepositoryOid: target.repository.skillRepositoryOid },
            orderBy: { oid: 'desc' },
            include: { skillRepository: true }
          });
          expect(propagation).toMatchObject({
            contentRevision: destination.contentRevision,
            status: 'completed',
            manifestOid: null,
            skillRepositoryOid: target.repository.skillRepositoryOid
          });
          legacyBranchName = propagation!.branchName;
          expect(propagation!.skillRepository.deletionsAppliedAt).not.toBeNull();
        }
      });

      it('refuses to migrate while deletes are owed, a sync is active or unfinished, or file hashes are missing', async () => {
        let snapshot = async () => ({
          destination: await loadDestination(target.destinationOid),
          items: await db.skillDestinationItem.findMany({
            where: { destinationOid: target.destinationOid },
            orderBy: { oid: 'asc' }
          }),
          rows: await destinationRows(target.destinationOid),
          syncs: await db.skillDestinationSync.count({
            where: { destinationOid: target.destinationOid }
          })
        });
        let migrate = async () =>
          await migrateSkillDestinationToManifest({
            destinationId: target.destinationId,
            requestedBy: 'ops'
          });
        let before = await snapshot();
        expect(before.items.every(item => item.hash !== '')).toBe(true);

        if (target.repository) {
          let owed = await db.skillDestinationDeletedFile.create({
            data: {
              destinationOid: target.destinationOid,
              path: `${target.skillBase}/references/gone.md`,
              createdAt: new Date(Date.now() + 1000)
            }
          });
          expect(await migrate()).toEqual({ status: 'blocked', reason: 'deletes_owed' });
          await db.skillDestinationDeletedFile.delete({ where: { oid: owed.oid } });
        }

        let fakeSync = await db.skillDestinationSync.create({
          data: {
            id: await ID.generateId('skillDestinationSync'),
            destinationOid: target.destinationOid,
            status: 'processing',
            storageMode: 'code_bucket'
          }
        });
        expect(await migrate()).toEqual({ status: 'blocked', reason: 'sync_active' });
        await db.skillDestinationSync.update({
          where: { oid: fakeSync.oid },
          data: { status: 'canceled', completedAt: new Date() }
        });
        expect(await migrate()).toEqual({
          status: 'blocked',
          reason: 'latest_sync_not_completed'
        });
        await db.skillDestinationSync.delete({ where: { oid: fakeSync.oid } });

        await db.file.update({
          where: { oid: target.content.legacy.file.oid },
          data: {
            contentSha256: null,
            contentSha256StoreId: null,
            contentGitBlobSha: null,
            contentCrc32: null
          }
        });
        expect(await migrate()).toEqual({ status: 'blocked', reason: 'file_hashes_missing' });

        let after = await snapshot();
        expect(after).toEqual(before);

        let hashed = await eventually(async () => {
          let file = await db.file.findUniqueOrThrow({
            where: { oid: target.content.legacy.file.oid }
          });
          expect(hasValidContentHashes(file)).toBe(true);
          return file;
        }, syncTimeout);
        expect(hashed.storeId).toBe(target.content.legacy.storeId);
        expect(hashed.contentSha256).toBe(hashBytes(target.content.legacy.bytes).sha256);
      });

      it(`migrates through the ${migrateVia} to a manifest identical to the code bucket`, async () => {
        let requestedAt = new Date();
        let syncOidBefore = await latestSyncOid(target.destinationOid);
        bucketCallsAtMigration = codeBucket.callsFor(legacyBucketId).length;
        codeBucketSyncsAtMigration = target.repository
          ? codeBucketSyncsFor(target.repository.repoId).length
          : 0;

        if (migrateVia === 'ops service') {
          expect(
            await skillDestinationStorageService.migrateSkillDestinationStorage({
              skillDestinationId: target.destinationId
            })
          ).toEqual({ enqueued: 'destination' });
        } else if (migrateVia === 'cron') {
          await skillDestinationMigrateStorageManyQueue.add({
            cursor: target.destinationId.slice(0, -1)
          });
        } else {
          expect(
            await migrateSkillDestinationToManifest({
              destinationId: target.destinationId,
              requestedBy: 'ops'
            })
          ).toEqual({ status: 'migrated' });
        }

        let migrated = await eventually(async () => {
          let destination = await loadDestination(target.destinationOid);
          expect(destination.storageMode).toBe('manifest');
          return destination;
        }, syncTimeout);
        expect(migrated).toMatchObject({
          codeBucketId: legacyBucketId,
          storageModeChangedAt: expect.any(Date)
        });
        expect(migrated.storageModeChangedAt!.getTime()).toBeGreaterThanOrEqual(
          requestedAt.getTime() - 1000
        );

        let migrationSync = await db.skillDestinationSync.findFirstOrThrow({
          where: {
            destinationOid: target.destinationOid,
            trigger: 'migration',
            oid: { gt: syncOidBefore }
          }
        });
        let settled = await settleDestination(target.destinationOid, migrationSync.oid);
        expect(settled).toMatchObject({
          storageMode: 'manifest',
          manifestOid: expect.any(BigInt)
        });
        expect((await loadDestination(target.destinationOid)).currentManifestOid).toBe(
          settled.manifestOid
        );

        let manifest = await readManifestFiles(settled.manifest!);
        expect(sortedPaths(manifest.files)).toEqual(legacyRowPaths);
        expect(sortedPaths(manifest.files)).toEqual(sortedPaths(legacyFiles));
        expectSameFiles(manifest.files, legacyFiles);
        for (let entry of manifest.entries) {
          expect(hashBytes(legacyFiles.get(entry.path)!), entry.path).toEqual({
            sha256: entry.sha256,
            gitBlobSha: entry.gitBlobSha,
            crc32: entry.crc32,
            size: entry.size
          });
        }

        let entryAt = (path: string) =>
          manifest.entries.find(entry => entry.path === `${target.skillBase}/${path}`)!;
        expect(entryAt('assets/legacy.png').key).toBe(target.content.legacy.storeId);
        expect(entryAt('assets/icon.png').key).toBe(
          (await db.file.findUniqueOrThrow({ where: { oid: target.content.icon.file.oid } }))
            .storeId
        );
        expect(entryAt('references/data.txt').key).toMatch(/^skill-sync\/blobs\/sha256\//);
        expect(await readObjectBytes(entryAt('references/data.txt').key)).toEqual(
          target.content.pending.bytes
        );

        expect(
          manifest.entries.filter(entry => !scopeContains(manifest.header.scope, entry.path))
        ).toEqual([]);
        expect(
          sortedPaths(legacyFiles).filter(
            path => scopeContains(manifest.header.scope, path) && !manifest.files.has(path)
          )
        ).toEqual([]);

        let rows = await destinationRows(target.destinationOid);
        expect(rows.map(rowPath).sort()).toEqual(legacyRowPaths);
        expect(
          rows
            .filter(row => {
              let entry = manifest.entries.find(entry => entry.path === rowPath(row))!;
              return (
                row.signature !== `git:${entry.gitBlobSha}` ||
                row.gitBlobSha !== entry.gitBlobSha ||
                row.sha256 !== entry.sha256 ||
                row.updatedAt.getTime() < migrated.storageModeChangedAt!.getTime()
              );
            })
            .map(row => row.path)
        ).toEqual([]);
        expect(
          await db.skillDestinationItem.count({
            where: { destinationOid: target.destinationOid, hash: '' }
          })
        ).toBe(0);

        if (target.repository) {
          let call = await expectManifestPropagation(target, settled.oid, settled.manifest!);
          expect(call.payload.previousManifest).toBeUndefined();
          let propagation = (await syncPropagations(settled.oid))[0]!;
          expect(propagation.branchName).not.toBe(legacyBranchName);
          expect(codeBucketSyncsFor(target.repository.repoId)).toHaveLength(
            codeBucketSyncsAtMigration
          );
        }
        expect(codeBucket.callsFor(legacyBucketId)).toHaveLength(bucketCallsAtMigration);

        current = { sync: settled, manifest, row: settled.manifest! };
      });

      it('re-applies only edited, added and removed content after migration', async () => {
        let guidePath = `${target.skillBase}/references/guide.md`;
        await editDocument(
          fixture,
          target.content.guideDocumentId,
          `guide v2 ${uniqueId('edit')}`
        );
        let edited = await advance([guidePath], []);
        expect(edited.files.get(guidePath)!.toString()).toMatch(/^guide v2 /);

        let addedPath = `${target.skillBase}/references/added.md`;
        await addDocument(
          fixture,
          target.content.skill,
          '/references/added.md',
          uniqueId('added')
        );
        let additions = [addedPath];
        if (target.secondary) {
          let gamma = await addSkillWithSlug(fixture, target.pluginId, 'gamma');
          additions.push(`${target.skillsBase}/${gamma.slug}/SKILL.md`);
        }
        await advance(additions, []);

        let notesPath = `${target.skillBase}/references/deep/nested/notes.md`;
        await removeStorePath(
          fixture,
          target.content.skill,
          '/references/deep/nested/notes.md'
        );
        let removals = [notesPath];
        if (target.secondary) {
          await removePluginSkill(fixture, target.secondary.pluginSkillId);
          let betaBase = `${target.skillsBase}/${target.secondary.slug}`;
          removals.push(`${betaBase}/SKILL.md`, `${betaBase}/references/b.md`);
        }
        let removed = await advance([], removals);
        expectSameFiles(removed.files, await renderDestination(target));
      });

      it('exports the current manifest as a zip without touching the code bucket', async () => {
        let created = await skillExportService.createSkillExport({
          project: fixture.project,
          instance: fixture.instance,
          input:
            kind === 'marketplace'
              ? { target: 'marketplace', skillMarketplaceId: target.marketplaceId! }
              : kind === 'plugin'
                ? { target: 'plugin', skillPluginId: target.pluginId }
                : { target: 'skill', skillId: target.content.skill.id }
        });

        let completed = await eventually(async () => {
          let stored = await db.skillExport.findUniqueOrThrow({
            where: { id: created.id },
            include: { file: true }
          });
          expect(stored.status).toBe('completed');
          return stored;
        }, syncTimeout);

        let archive = readZipArchive(await readObjectBytes(completed.file!.storeId));
        let archived = new Map(archive.map(entry => [entry.path, Buffer.from(entry.data)]));
        expectSameFiles(archived, current.manifest.files);
        expect(codeBucket.callsFor(legacyBucketId)).toHaveLength(bucketCallsAtMigration);
      });

      it('deletes the legacy code bucket 14 days after migration and keeps syncing', async () => {
        expect(
          await deleteMigratedSkillDestinationCodeBucket({
            destinationId: target.destinationId
          })
        ).toBe(false);

        let migratedAt = new Date(Date.now() - 20 * day);
        let completedAt = new Date(Date.now() - 15 * day);
        await db.skillDestination.update({
          where: { oid: target.destinationOid },
          data: { storageModeChangedAt: migratedAt }
        });
        let manifestSyncs = await db.skillDestinationSync.findMany({
          where: {
            destinationOid: target.destinationOid,
            storageMode: 'manifest',
            status: 'completed'
          },
          select: { oid: true }
        });
        await db.skillDestinationSync.updateMany({
          where: { oid: { in: manifestSyncs.map(sync => sync.oid) } },
          data: { completedAt }
        });
        await db.skillDestinationSyncRepositoryPropagation.updateMany({
          where: {
            skillDestinationSyncOid: { in: manifestSyncs.map(sync => sync.oid) },
            status: 'completed'
          },
          data: { completedAt }
        });

        if (kind === 'marketplace') {
          await skillDestinationDeleteCodeBucketManyQueue.add({
            cursor: target.destinationId.slice(0, -1)
          });
          await eventually(async () => {
            expect((await loadDestination(target.destinationOid)).codeBucketId).toBeNull();
          }, syncTimeout);
        } else {
          expect(
            await deleteMigratedSkillDestinationCodeBucket({
              destinationId: target.destinationId
            })
          ).toBe(true);
        }

        expect(
          origin
            .callsTo('codeBucket:delete')
            .filter(call => call.payload.codeBucketId === legacyBucketId)
        ).toHaveLength(1);
        expect(await loadDestination(target.destinationOid)).toMatchObject({
          storageMode: 'manifest',
          codeBucketId: null
        });

        let guidePath = `${target.skillBase}/references/guide.md`;
        await editDocument(
          fixture,
          target.content.guideDocumentId,
          `guide v3 ${uniqueId('edit')}`
        );
        let manifest = await advance([guidePath], []);
        expect(manifest.files.get(guidePath)!.toString()).toMatch(/^guide v3 /);
      });

      let demotion: {
        bucketId: string;
        demotedAt: Date;
        syncOid: bigint;
        manifestFiles: Map<string, Buffer>;
        manifestCalls: number;
        manifestCount: number;
      };

      it('demotes to a fresh code bucket and resyncs every manifest file on the legacy path', async () => {
        let manifestFiles = current.manifest.files;
        let manifestCalls = manifestCallsFor(target).length;
        let manifestCount = await db.skillDestinationManifest.count({
          where: { destinationOid: target.destinationOid }
        });
        let syncOidBefore = await latestSyncOid(target.destinationOid);

        let demoted = await skillDestinationStorageService.demoteSkillDestinationToCodeBucket({
          skillDestinationId: target.destinationId,
          auditScope: fixture.auditScope
        });
        expect(demoted).toMatchObject({
          storageMode: 'code_bucket',
          storageModeChangedAt: expect.any(Date),
          codeBucketId: expect.any(String)
        });
        let bucketId = demoted.codeBucketId!;
        expect(bucketId).not.toBe(legacyBucketId);
        expect(origin.bucketCreation(bucketId)).toBeDefined();

        let demotionSync = await db.skillDestinationSync.findFirstOrThrow({
          where: {
            destinationOid: target.destinationOid,
            trigger: 'migration',
            oid: { gt: syncOidBefore }
          }
        });
        let settled = await settleDestination(target.destinationOid, demotionSync.oid);
        expect(settled).toMatchObject({ storageMode: 'code_bucket', manifestOid: null });
        demotion = {
          bucketId,
          demotedAt: demoted.storageModeChangedAt!,
          syncOid: settled.oid,
          manifestFiles,
          manifestCalls,
          manifestCount
        };

        expect(
          [...new Set(codeBucket.writesFor(bucketId).flatMap(call => call.paths))].sort()
        ).toEqual(sortedPaths(manifestFiles));
        expect(manifestCallsFor(target)).toHaveLength(manifestCalls);
        if (target.repository) {
          expect(
            codeBucketSyncsFor(target.repository.repoId).filter(
              call => call.payload.codeBucketId === bucketId
            ).length
          ).toBeGreaterThan(0);
          let [propagation] = await syncPropagations(settled.oid);
          expect(propagation).toMatchObject({ status: 'completed', manifestOid: null });
        }
      });

      it('keeps every manifest file in the demoted code bucket', async () => {
        expectSameFiles(codeBucket.files(demotion.bucketId), demotion.manifestFiles);
      });

      it('records no file deletions on the first legacy sync after demotion', async () => {
        expect(
          await db.skillDestinationDeletedFile.findMany({
            where: {
              destinationOid: target.destinationOid,
              createdAt: { gte: demotion.demotedAt }
            },
            select: { path: true }
          })
        ).toEqual([]);
        if (target.repository) {
          expect(
            codeBucketSyncsFor(target.repository.repoId)
              .filter(call => call.payload.codeBucketId === demotion.bucketId)
              .flatMap(call => call.payload.deletePaths)
          ).toEqual([]);
        }
      });

      it('syncs edits after demotion through the legacy path only', async () => {
        let writesBeforeEdit = codeBucket.writesFor(demotion.bucketId).length;
        let guidePath = `${target.skillBase}/references/guide.md`;
        let edit = `guide v4 ${uniqueId('edit')}`;
        await editDocument(fixture, target.content.guideDocumentId, edit);
        let edited = await syncDestination(target.destinationOid);
        expect(edited).toMatchObject({ storageMode: 'code_bucket', manifestOid: null });

        let writtenPaths = [
          ...new Set(
            codeBucket
              .writesFor(demotion.bucketId)
              .slice(writesBeforeEdit)
              .flatMap(call => call.paths)
          )
        ];
        expect(writtenPaths).toContain(guidePath);
        expect(writtenPaths.filter(path => !isUnder(path, target.skillBase))).toEqual([]);
        expect(codeBucket.files(demotion.bucketId).get(guidePath)!.toString()).toBe(edit);
        expect(manifestCallsFor(target)).toHaveLength(demotion.manifestCalls);
        expect(
          await db.skillDestinationManifest.count({
            where: { destinationOid: target.destinationOid }
          })
        ).toBe(demotion.manifestCount);
        expect(codeBucket.callsFor(legacyBucketId)).toHaveLength(bucketCallsAtMigration);
      });

      it('is skipped by the migration cron after demotion', async () => {
        let demoted = await loadDestination(target.destinationOid);
        let migrationSyncs = await db.skillDestinationSync.count({
          where: { destinationOid: target.destinationOid, trigger: 'migration' }
        });

        let sentinel = await createMarketplace(fixture);
        let sentinelDestination = await loadDestination(sentinel.destinationOid!);
        expect(sentinelDestination.storageMode).toBe('code_bucket');
        expect(sentinelDestination.id > target.destinationId).toBe(true);

        await skillDestinationMigrateStorageManyQueue.add({
          cursor: target.destinationId.slice(0, -1)
        });
        await eventually(async () => {
          expect((await loadDestination(sentinelDestination.oid)).storageMode).toBe(
            'manifest'
          );
        }, syncTimeout);
        await settleDestination(sentinelDestination.oid);

        expect(await loadDestination(target.destinationOid)).toMatchObject({
          storageMode: 'code_bucket',
          codeBucketId: demoted.codeBucketId,
          storageModeChangedAt: demoted.storageModeChangedAt
        });
        expect(
          await db.skillDestinationSync.count({
            where: { destinationOid: target.destinationOid, trigger: 'migration' }
          })
        ).toBe(migrationSyncs);
        expect(
          await migrateSkillDestinationToManifest({
            destinationId: target.destinationId,
            requestedBy: 'cron'
          })
        ).toEqual({ status: 'blocked', reason: 'demoted' });
      });

      if (kind === 'managed') {
        it('demotes a managed plugin to a bucket with the managed-plugin purpose', async () => {
          let destination = await loadDestination(target.destinationOid);
          expect(legacyBucketPurpose).toBe('cargo.skill.managed-plugin');
          expect(origin.bucketCreation(destination.codeBucketId)?.payload.purpose).toBe(
            legacyBucketPurpose
          );
        });
      }

      it('forgets manifest state on demotion and migrates back from scratch on request', async () => {
        expect((await loadDestination(target.destinationOid)).currentManifestOid).toBeNull();
        expect(
          (await destinationRows(target.destinationOid))
            .map(row => row.path)
            .filter(path => !path.startsWith('/'))
        ).toEqual([]);
        if (target.repository) {
          expect(
            await db.skillRepository.findUniqueOrThrow({
              where: { oid: target.repository.skillRepositoryOid }
            })
          ).toMatchObject({ lastPropagatedManifestOid: null, dismissedManifestSha256: null });
        }

        let bucketFiles = codeBucket.files(demotion.bucketId);
        let syncOidBefore = await latestSyncOid(target.destinationOid);
        expect(
          await migrateSkillDestinationToManifest({
            destinationId: target.destinationId,
            requestedBy: 'ops'
          })
        ).toEqual({ status: 'migrated' });

        let migrationSync = await db.skillDestinationSync.findFirstOrThrow({
          where: {
            destinationOid: target.destinationOid,
            trigger: 'migration',
            oid: { gt: syncOidBefore }
          }
        });
        let settled = await settleDestination(target.destinationOid, migrationSync.oid);
        expect(settled).toMatchObject({
          storageMode: 'manifest',
          manifestOid: expect.any(BigInt)
        });
        let manifest = await readManifestFiles(settled.manifest!);
        expectSameFiles(manifest.files, bucketFiles);
        expect(
          (await destinationRows(target.destinationOid)).map(row => row.path).sort()
        ).toEqual(sortedPaths(manifest.files));
        expect(
          await db.skillDestinationDeletedFile.count({
            where: {
              destinationOid: target.destinationOid,
              createdAt: { gte: demotion.demotedAt }
            }
          })
        ).toBe(0);

        if (target.repository) {
          let call = await expectManifestPropagation(target, settled.oid, settled.manifest!);
          expect(call.payload.previousManifest).toBeUndefined();
        }
      });
    });
  }
});
