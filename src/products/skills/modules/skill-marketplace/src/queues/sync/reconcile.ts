import { createCodeBucketClient } from '@mtsrc/scm-code-bucket-client-internal';
import { db } from '@metorial/db';
import { createQueue, deleteInChunks } from '@metorial/queue';
import { getSkillDestinationCodeBucketId } from '@metorial/skills-scm-utils';
import PQueue from 'p-queue';
import { env } from '../../env';
import { recordDestinationFileDeletions } from './_lib/deletions';
import { getSyncItemKey } from './_lib/item';
import { destinationBucketIsAvailable } from './_lib/bucket';
import { withDestinationSyncLock } from './_lib/lock';
import { appendSkillDestinationSyncLog } from './_lib/logs';
import {
  areCodeBucketRepositoriesCurrent,
  canSkipUnchangedSync,
  finishUnchangedSync,
  incrementDestinationContentRevision
} from './_lib/unchangedSync';
import { syncPropagateStartQueue } from './propagate';
import { syncSnapshotQueue } from './snapshot';

let orphanDeleteChunkSize = 500;

let codeBucketClient = createCodeBucketClient({
  address: env.origin.CODE_BUCKET_SERVICE_URL
});

export let syncReconcileQueue = createQueue<{
  skillDestinationSyncId: string;
  contentVersion?: number;
  hasChanges?: boolean;
  skillRepositoryId?: string;
}>({
  name: 'cargo/skill/sync/reconcile',
  workerOpts: {
    concurrency: 10
  }
});

export let syncReconcileQueueProcessor = syncReconcileQueue.process(
  withDestinationSyncLock(async data => {
    let sync = await db.skillDestinationSync.findUnique({
      where: { id: data.skillDestinationSyncId },
      include: { destination: true }
    });
    if (!sync || sync.status !== 'processing' || sync.isAtRepoSyncStage) return;
    if ((data.contentVersion ?? 0) !== sync.contentVersion) return;

    if (sync.destination.storageMode === 'manifest') {
      let liveItems = await db.skillDestinationItem.findMany({
        where: { destinationOid: sync.destinationOid },
        include: { skill: true, skillPlugin: true, skillMarketplace: true }
      });
      let liveItemKeys = liveItems.map(getSyncItemKey);
      let { deleted } = await deleteInChunks({
        chunkSize: orphanDeleteChunkSize,
        maxChunks: Number.MAX_SAFE_INTEGER,
        selectKeys: async take =>
          (
            await db.skillDestinationFile.findMany({
              where: {
                destinationOid: sync.destinationOid,
                OR: [{ itemKey: null }, { itemKey: { notIn: liveItemKeys } }]
              },
              select: { oid: true },
              orderBy: { oid: 'asc' },
              take
            })
          ).map(file => file.oid),
        deleteKeys: async oids =>
          await db.skillDestinationFile.deleteMany({ where: { oid: { in: oids } } })
      });

      if (deleted > 0) {
        await appendSkillDestinationSyncLog(
          data.skillDestinationSyncId,
          `Removed ${deleted} file${deleted === 1 ? '' : 's'} that no longer belong to this destination.`
        );
      }

      await syncSnapshotQueue.add({
        skillDestinationSyncId: data.skillDestinationSyncId,
        contentVersion: sync.contentVersion,
        hasChanges: data.hasChanges || deleted > 0,
        skillRepositoryId: data.skillRepositoryId
      });
      return;
    }

    if (sync.contentVersion === 0 && !(await destinationBucketIsAvailable(sync))) return;

    let items = await db.skillDestinationItem.findMany({
      where: { destinationOid: sync.destinationOid },
      include: { skill: true, skillPlugin: true, skillMarketplace: true }
    });
    let liveItemKeys = new Set(items.map(getSyncItemKey));

    let files = await db.skillDestinationFile.findMany({
      where: { destinationOid: sync.destinationOid },
      select: { path: true, itemKey: true }
    });

    let orphanedPaths = files
      .filter(file => file.itemKey && !liveItemKeys.has(file.itemKey))
      .map(file => file.path);

    if (orphanedPaths.length > 0) {
      let queue = new PQueue({ concurrency: 10 });

      await queue.addAll(
        orphanedPaths.map(
          orphanedPath => () =>
            codeBucketClient.deleteBucketFile({
              bucketId: getSkillDestinationCodeBucketId(sync.destination),
              path: orphanedPath
            })
        )
      );

      await recordDestinationFileDeletions({
        destinationOid: sync.destinationOid,
        paths: orphanedPaths
      });

      let listed = orphanedPaths.slice(0, 10).join(', ');
      let remaining = orphanedPaths.length - 10;

      await appendSkillDestinationSyncLog(
        data.skillDestinationSyncId,
        `Removed ${orphanedPaths.length} file${
          orphanedPaths.length === 1 ? '' : 's'
        } that no longer belong to this destination: ${listed}${
          remaining > 0 ? ` and ${remaining} more` : ''
        }.`
      );
    }

    if (orphanedPaths.length > 0) {
      await incrementDestinationContentRevision(sync.destinationOid);
    }

    let hasChanges = !!data.hasChanges || orphanedPaths.length > 0;

    // Persisted item hashes can outlive a failed handoff, so unchanged files alone do not prove
    // that repositories received them; the content revision of their last propagation does.
    if (
      canSkipUnchangedSync({ sync, hasChanges, skillRepositoryId: data.skillRepositoryId }) &&
      (await areCodeBucketRepositoriesCurrent(sync.destinationOid))
    ) {
      await finishUnchangedSync({
        syncOid: sync.oid,
        skillDestinationSyncId: data.skillDestinationSyncId
      });
      return;
    }

    await appendSkillDestinationSyncLog(
      data.skillDestinationSyncId,
      hasChanges
        ? 'Content updates are ready.'
        : 'No content updates were needed; continuing with repository updates.'
    );
    await syncPropagateStartQueue.add({
      skillDestinationSyncId: data.skillDestinationSyncId,
      contentVersion: sync.contentVersion,
      skillRepositoryId: data.skillRepositoryId
    });
  })
);
