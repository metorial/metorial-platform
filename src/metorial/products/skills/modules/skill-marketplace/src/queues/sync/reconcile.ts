import { createCodeBucketClient } from '@metorial/code-bucket-service-generated';
import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import PQueue from 'p-queue';
import { env } from '../../env';
import { recordDestinationFileDeletions } from './_lib/deletions';
import { getSyncItemKey } from './_lib/item';
import { destinationBucketIsAvailable } from './_lib/bucket';
import { withDestinationSyncLock } from './_lib/lock';
import { appendSkillDestinationSyncLog } from './_lib/logs';
import { syncPropagateStartQueue } from './propagate';

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
              bucketId: sync.destination.codeBucketId,
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

    let hasChanges = data.hasChanges || orphanedPaths.length > 0;

    await appendSkillDestinationSyncLog(
      data.skillDestinationSyncId,
      hasChanges
        ? 'Content updates are ready.'
        : 'No content updates were needed; continuing with repository updates.'
    );
    // Persisted item hashes can outlive a failed handoff, so unchanged files do not prove
    // that repositories received them. Repository initialization and policy updates need this too.
    await syncPropagateStartQueue.add({
      skillDestinationSyncId: data.skillDestinationSyncId,
      contentVersion: sync.contentVersion,
      skillRepositoryId: data.skillRepositoryId
    });
  })
);
