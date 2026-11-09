import { db, ID, withTransaction } from '@metorial/db';
import { getCargoFilesBucketName, getStorage } from '@metorial/module-file';
import { createQueue } from '@metorial/queue';
import {
  ManifestFileError,
  manifestFormatLimits,
  manifestFormatVersion,
  type ManifestEntry
} from '../../lib/manifestFile/format';
import { getManifestObjectKey, uploadManifestFile } from '../../lib/manifestFile/storage';
import {
  spoolAboveManifestEntries,
  spoolSortedManifestFile,
  writeSortedManifestFile
} from '../../lib/manifestFile/writer';
import { isObjectMissingError, lockSkillSyncObjects } from './_lib/blobStore';
import { getSyncItemKey } from './_lib/item';
import { withDestinationSyncLock } from './_lib/lock';
import { appendSkillDestinationSyncLog } from './_lib/logs';
import { getSkillDestinationKind, getSkillDestinationManifestScope } from './_lib/scope';
import { syncFinishQueue } from './finish';
import { syncPropagateStartQueue } from './propagate';

let rowPageSize = 1000;
let listedPathCount = 10;

type SnapshotRow = {
  path: string;
  pathBytes: Uint8Array;
  gitBlobSha: string;
  sha256: string;
  byteSize: bigint;
  crc32: bigint;
  sourceKey: string;
};

let incompleteRowWhere = (destinationOid: bigint) => ({
  destinationOid,
  OR: [
    { gitBlobSha: null },
    { sha256: null },
    { byteSize: null },
    { crc32: null },
    { sourceKey: null }
  ]
});

export let readSkillDestinationSnapshotRows = async function* (
  destinationOid: bigint,
  pageSize = rowPageSize
) {
  await db.$executeRaw`
    UPDATE "SkillDestinationFile"
    SET "pathBytes" = convert_to("path", 'UTF8')
    WHERE "destinationOid" = ${destinationOid} AND "pathBytes" IS NULL
  `;

  let cursor: Uint8Array | null = null;
  let pageLength = pageSize;

  while (pageLength === pageSize) {
    let rows: SnapshotRow[] = cursor
      ? await db.$queryRaw<SnapshotRow[]>`
          SELECT "path", "pathBytes", "gitBlobSha", "sha256", "byteSize", "crc32", "sourceKey"
          FROM "SkillDestinationFile"
          WHERE "destinationOid" = ${destinationOid} AND "pathBytes" > ${cursor}
          ORDER BY "pathBytes"
          LIMIT ${pageSize}
        `
      : await db.$queryRaw<SnapshotRow[]>`
          SELECT "path", "pathBytes", "gitBlobSha", "sha256", "byteSize", "crc32", "sourceKey"
          FROM "SkillDestinationFile"
          WHERE "destinationOid" = ${destinationOid}
          ORDER BY "pathBytes"
          LIMIT ${pageSize}
        `;

    for (let row of rows) {
      yield {
        path: row.path,
        gitBlobSha: row.gitBlobSha,
        sha256: row.sha256,
        size: Number(row.byteSize),
        crc32: Number(row.crc32),
        key: row.sourceKey
      } satisfies ManifestEntry;
    }

    pageLength = rows.length;
    cursor = rows.at(-1)?.pathBytes ?? cursor;
  }
};

let failSnapshot = async (d: {
  syncOid: bigint;
  skillDestinationSyncId: string;
  message: string;
}) => {
  await db.skillDestinationSync.updateMany({
    where: { oid: d.syncOid, status: 'processing' },
    data: { status: 'failed', completedAt: new Date() }
  });
  await appendSkillDestinationSyncLog(d.skillDestinationSyncId, d.message);
};

export let syncSnapshotQueue = createQueue<{
  skillDestinationSyncId: string;
  contentVersion?: number;
  hasChanges?: boolean;
  skillRepositoryId?: string;
}>({
  name: 'cargo/skill/sync/snapshot',
  workerOpts: {
    concurrency: 10
  }
});

export let syncSnapshotQueueProcessor = syncSnapshotQueue.process(
  withDestinationSyncLock(async data => {
    let sync = await db.skillDestinationSync.findUnique({
      where: { id: data.skillDestinationSyncId },
      include: {
        destination: {
          include: { currentManifest: true, skillMarketplace: true, skillPlugin: true }
        }
      }
    });
    if (!sync || sync.status !== 'processing' || sync.isAtRepoSyncStage) return;
    if ((data.contentVersion ?? 0) !== sync.contentVersion) return;
    if (sync.destination.storageMode !== 'manifest') return;

    let { destination } = sync;
    let fail = (message: string) =>
      failSnapshot({
        syncOid: sync.oid,
        skillDestinationSyncId: data.skillDestinationSyncId,
        message
      });

    let incomplete = await db.skillDestinationFile.findMany({
      where: incompleteRowWhere(destination.oid),
      select: { path: true, itemKey: true },
      orderBy: { oid: 'asc' },
      take: listedPathCount
    });
    if (incomplete.length) {
      let incompleteCount = await db.skillDestinationFile.count({
        where: incompleteRowWhere(destination.oid)
      });
      let items = await db.skillDestinationItem.findMany({
        where: { destinationOid: destination.oid },
        include: { skill: true, skillPlugin: true, skillMarketplace: true }
      });
      let itemKeys = new Set(incomplete.flatMap(file => (file.itemKey ? [file.itemKey] : [])));

      // Re-applying the owning items rewrites their rows with hashes on the next sync.
      await db.skillDestinationItem.updateMany({
        where: {
          oid: {
            in: items.filter(item => itemKeys.has(getSyncItemKey(item))).map(item => item.oid)
          }
        },
        data: { hash: '' }
      });
      await fail(
        `${incompleteCount} file${incompleteCount === 1 ? ' is' : 's are'} missing content hashes (manifest_incomplete): ${incomplete
          .map(file => file.path)
          .join(
            ', '
          )}${incompleteCount > incomplete.length ? ' and more' : ''}. They will be rewritten by the next sync.`
      );
      return;
    }

    let totals = await db.skillDestinationFile.aggregate({
      where: { destinationOid: destination.oid },
      _count: { _all: true },
      _sum: { byteSize: true }
    });
    let entryCount = totals._count._all;
    let totalBytes = Number(totals._sum.byteSize ?? 0n);

    if (entryCount > manifestFormatLimits.maxEntries) {
      await fail(
        `This destination has ${entryCount} files; at most ${manifestFormatLimits.maxEntries} can be synced (destination_too_large).`
      );
      return;
    }

    if (entryCount === 0) {
      let liveItemCount = await db.skillDestinationItem.count({
        where: { destinationOid: destination.oid }
      });

      if (liveItemCount > 0 || (destination.currentManifest?.entryCount ?? 0) > 0) {
        await fail(
          'Refusing to publish an empty manifest for a destination that still has content (empty_manifest).'
        );
        return;
      }

      await db.skillDestinationSync.update({
        where: { oid: sync.oid },
        data: { isAtRepoSyncStage: true }
      });
      await appendSkillDestinationSyncLog(
        data.skillDestinationSyncId,
        'There is no content to publish.'
      );
      await syncFinishQueue.add({ skillDestinationSyncId: data.skillDestinationSyncId });
      return;
    }

    let written;
    try {
      let input = {
        destinationId: destination.id,
        sourceBucket: getCargoFilesBucketName(),
        scope: getSkillDestinationManifestScope(getSkillDestinationKind(destination)),
        entryCount,
        totalBytes,
        entries: readSkillDestinationSnapshotRows(destination.oid)
      };
      written =
        entryCount > spoolAboveManifestEntries
          ? await spoolSortedManifestFile(input)
          : await writeSortedManifestFile(input);
    } catch (error) {
      if (!(error instanceof ManifestFileError)) throw error;

      await fail(
        `Could not build the destination manifest (manifest_invalid): ${error.message}`
      );
      return;
    }

    try {
      let objectKey = getManifestObjectKey({
        destinationId: destination.id,
        sha256: written.sha256
      });

      let { manifest, created } = await withTransaction(async db => {
        await lockSkillSyncObjects([objectKey]);

        let existing = await db.skillDestinationManifest.findUnique({
          where: {
            destinationOid_sha256: { destinationOid: destination.oid, sha256: written.sha256 }
          }
        });
        let manifest = existing
          ? await db.skillDestinationManifest.update({
              where: { oid: existing.oid },
              data: { lastReferencedAt: new Date() }
            })
          : await db.skillDestinationManifest.create({
              data: {
                id: await ID.generateId('skillDestinationManifest'),
                sha256: written.sha256,
                objectKey,
                formatVersion: manifestFormatVersion,
                entryCount: written.entryCount,
                totalBytes: BigInt(written.totalBytes),
                destinationOid: destination.oid
              }
            });

        await db.skillDestination.update({
          where: { oid: destination.oid },
          data: { currentManifestOid: manifest.oid }
        });
        await db.skillDestinationSync.update({
          where: { oid: sync.oid },
          data: { manifestOid: manifest.oid }
        });

        return { manifest, created: !existing };
      });

      let objectExists =
        !created &&
        (await getStorage()
          .headObject(getCargoFilesBucketName(), manifest.objectKey)
          .then(() => true)
          .catch(error => {
            if (isObjectMissingError(error)) return false;
            throw error;
          }));
      if (!objectExists) {
        await uploadManifestFile({ destinationId: destination.id, manifest: written });
      }

      let unchanged = destination.currentManifestOid === manifest.oid;
      await appendSkillDestinationSyncLog(
        data.skillDestinationSyncId,
        unchanged
          ? `Content is unchanged (manifest ${written.sha256.slice(0, 12)}, ${entryCount} files); continuing with repository updates.`
          : `Content updates are ready (manifest ${written.sha256.slice(0, 12)}, ${entryCount} files).`
      );

      await syncPropagateStartQueue.add({
        skillDestinationSyncId: data.skillDestinationSyncId,
        contentVersion: sync.contentVersion,
        skillRepositoryId: data.skillRepositoryId
      });
    } finally {
      if ('dispose' in written) await written.dispose();
    }
  })
);
