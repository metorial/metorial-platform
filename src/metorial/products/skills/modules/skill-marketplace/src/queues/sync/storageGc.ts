import { createCron } from '@metorial/cron';
import { db, withTransaction, type Prisma } from '@metorial/db';
import { getCargoFilesBucketName, getStorage } from '@metorial/module-file';
import { createQueue, dailyPacedDelay } from '@metorial/queue';
import { env } from '../../env';
import { manifestObjectKeyPrefix } from '../../lib/manifestFile/storage';
import {
  isObjectMissingError,
  lockSkillSyncObjects,
  skillSyncBlobKeyPrefix
} from './_lib/blobStore';

let pageSize = 500;

let activeSyncStatuses = ['pending', 'processing', 'waiting_for_review'] as const;

type GcPayload = { cursor?: string; retentionSeconds?: number };

let getCutoff = (retentionSeconds: number) => new Date(Date.now() - retentionSeconds * 1000);

let getBlobCutoff = (d: { retentionSeconds?: number }) =>
  getCutoff(d.retentionSeconds ?? env.skillSync.SKILL_SYNC_BLOB_RETENTION);

let getManifestCutoff = (d: { retentionSeconds?: number }) =>
  getCutoff(d.retentionSeconds ?? env.skillSync.SKILL_SYNC_MANIFEST_RETENTION);

export let deleteSkillSyncObject = async (key: string) => {
  try {
    await getStorage().deleteObject(getCargoFilesBucketName(), key);
  } catch (error) {
    if (!isObjectMissingError(error)) throw error;
  }
};

export let skillSyncBlobGcCron = createCron(
  {
    name: 'cargo/skill/sync/blob-gc',
    cron: '0 3 * * *'
  },
  async () => {
    await skillSyncBlobGcManyQueue.add({});
    await skillSyncManifestGcManyQueue.add({});
  }
);

export let skillSyncBlobGcManyQueue = createQueue<GcPayload>({
  name: 'cargo/skill/sync/blob-gc/many',
  workerOpts: {
    concurrency: 1
  }
});

export let skillSyncBlobGcManyQueueProcessor = skillSyncBlobGcManyQueue.process(async data => {
  let blobs = await db.skillSyncBlob.findMany({
    where: {
      oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined,
      lastReferencedAt: { lt: getBlobCutoff(data) }
    },
    orderBy: { oid: 'asc' },
    select: { oid: true, key: true },
    take: pageSize
  });
  if (!blobs.length) return;

  await skillSyncBlobGcSingleQueue.addManyWithOps(
    blobs.map(blob => ({
      data: { key: blob.key, retentionSeconds: data.retentionSeconds },
      opts: { id: `blob-gc:${blob.oid}` }
    }))
  );

  if (blobs.length === pageSize) {
    await skillSyncBlobGcManyQueue.add(
      {
        cursor: blobs[blobs.length - 1]!.oid.toString(),
        retentionSeconds: data.retentionSeconds
      },
      dailyPacedDelay()
    );
  }
});

let skillSyncBlobGcSingleQueue = createQueue<{ key: string; retentionSeconds?: number }>({
  name: 'cargo/skill/sync/blob-gc/single',
  jobOpts: { removeOnFail: true },
  workerOpts: {
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }
  }
});

// The object is deleted while the key's lock is held, so a writer re-adding the same content
// either runs first (and refreshes `lastReferencedAt`) or after the delete (and re-uploads).
export let skillSyncBlobGcSingleQueueProcessor = skillSyncBlobGcSingleQueue.process(
  async data => {
    await withTransaction(async db => {
      await lockSkillSyncObjects([data.key]);

      let blob = await db.skillSyncBlob.findUnique({ where: { key: data.key } });
      if (!blob || blob.lastReferencedAt >= getBlobCutoff(data)) return;

      let reference = await db.skillDestinationFile.findFirst({
        where: { sourceKey: data.key },
        select: { oid: true }
      });
      if (reference) {
        await db.skillSyncBlob.update({
          where: { oid: blob.oid },
          data: { lastReferencedAt: new Date() }
        });
        return;
      }

      await deleteSkillSyncObject(blob.key);
      await db.skillSyncBlob.delete({ where: { oid: blob.oid } });
    });
  }
);

// An export ref only pins its manifest while the archive it produced can still be reused.
let getLiveExportFileWhere = (now: Date) =>
  ({
    status: 'active',
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    skillExports: { some: { status: { not: 'failed' } } }
  }) satisfies Prisma.FileWhereInput;

let getCollectableManifestWhere = (d: { retentionSeconds?: number }) =>
  ({
    lastReferencedAt: { lt: getManifestCutoff(d) },
    currentForDestinations: { none: {} },
    lastPropagatedRepos: { none: {} },
    syncs: { none: { status: { in: [...activeSyncStatuses] } } },
    propagations: { none: { status: { in: [...activeSyncStatuses] } } },
    exportRefs: { none: { file: { is: getLiveExportFileWhere(new Date()) } } }
  }) satisfies Prisma.SkillDestinationManifestWhereInput;

export let skillSyncManifestGcManyQueue = createQueue<GcPayload>({
  name: 'cargo/skill/sync/manifest-gc/many',
  workerOpts: {
    concurrency: 1
  }
});

export let skillSyncManifestGcManyQueueProcessor = skillSyncManifestGcManyQueue.process(
  async data => {
    let manifests = await db.skillDestinationManifest.findMany({
      where: {
        oid: data.cursor ? { gt: BigInt(data.cursor) } : undefined,
        ...getCollectableManifestWhere(data)
      },
      orderBy: { oid: 'asc' },
      select: { oid: true },
      take: pageSize
    });
    if (!manifests.length) return;

    await skillSyncManifestGcSingleQueue.addManyWithOps(
      manifests.map(manifest => ({
        data: {
          manifestOid: manifest.oid.toString(),
          retentionSeconds: data.retentionSeconds
        },
        opts: { id: `manifest-gc:${manifest.oid}` }
      }))
    );

    if (manifests.length === pageSize) {
      await skillSyncManifestGcManyQueue.add(
        {
          cursor: manifests[manifests.length - 1]!.oid.toString(),
          retentionSeconds: data.retentionSeconds
        },
        dailyPacedDelay()
      );
    }
  }
);

let skillSyncManifestGcSingleQueue = createQueue<{
  manifestOid: string;
  retentionSeconds?: number;
}>({
  name: 'cargo/skill/sync/manifest-gc/single',
  jobOpts: { removeOnFail: true },
  workerOpts: {
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }
  }
});

export let skillSyncManifestGcSingleQueueProcessor = skillSyncManifestGcSingleQueue.process(
  async data => {
    let candidate = await db.skillDestinationManifest.findUnique({
      where: { oid: BigInt(data.manifestOid) },
      select: { objectKey: true }
    });
    if (!candidate) return;

    await withTransaction(async db => {
      await lockSkillSyncObjects([candidate.objectKey]);

      let manifest = await db.skillDestinationManifest.findFirst({
        where: { oid: BigInt(data.manifestOid), ...getCollectableManifestWhere(data) }
      });
      if (!manifest) return;

      let newest = await db.skillDestinationManifest.findMany({
        where: { destinationOid: manifest.destinationOid },
        orderBy: [{ createdAt: 'desc' }, { oid: 'desc' }],
        select: { oid: true },
        take: env.skillSync.SKILL_SYNC_MANIFEST_KEEP_LAST
      });
      if (newest.some(kept => kept.oid === manifest.oid)) return;

      await deleteSkillSyncObject(manifest.objectKey);
      await db.skillDestinationManifest.delete({ where: { oid: manifest.oid } });
    });
  }
);

let sweptPrefixes = [skillSyncBlobKeyPrefix, manifestObjectKeyPrefix];

let isSweptKey = (key: string) => sweptPrefixes.some(prefix => key.startsWith(prefix));

export let skillSyncObjectSweepCron = createCron(
  {
    name: 'cargo/skill/sync/object-sweep',
    cron: '0 4 * * 0'
  },
  async () => {
    await skillSyncObjectSweepManyQueue.addMany(sweptPrefixes.map(prefix => ({ prefix })));
  }
);

export let skillSyncObjectSweepManyQueue = createQueue<{
  prefix: string;
  continuationToken?: string;
  retentionSeconds?: number;
}>({
  name: 'cargo/skill/sync/object-sweep/many',
  workerOpts: {
    concurrency: 1
  }
});

let getSweepCutoff = (d: { retentionSeconds?: number }) =>
  getCutoff(
    d.retentionSeconds ??
      Math.max(
        env.skillSync.SKILL_SYNC_BLOB_RETENTION,
        env.skillSync.SKILL_SYNC_MANIFEST_RETENTION
      )
  );

let getTrackedKeys = async (keys: string[]) => {
  let blobKeys = keys.filter(key => key.startsWith(skillSyncBlobKeyPrefix));
  let manifestKeys = keys.filter(key => key.startsWith(manifestObjectKeyPrefix));

  let [blobs, manifests] = await Promise.all([
    blobKeys.length
      ? db.skillSyncBlob.findMany({ where: { key: { in: blobKeys } }, select: { key: true } })
      : [],
    manifestKeys.length
      ? db.skillDestinationManifest.findMany({
          where: { objectKey: { in: manifestKeys } },
          select: { objectKey: true }
        })
      : []
  ]);

  return new Set([
    ...blobs.map(blob => blob.key),
    ...manifests.map(manifest => manifest.objectKey)
  ]);
};

export let skillSyncObjectSweepManyQueueProcessor = skillSyncObjectSweepManyQueue.process(
  async data => {
    if (!isSweptKey(data.prefix)) return;

    let page = await getStorage().listObjectsPage(
      getCargoFilesBucketName(),
      data.prefix,
      pageSize,
      data.continuationToken
    );

    let cutoff = getSweepCutoff(data);
    let oldKeys = page.objects
      .filter(object => new Date(object.last_modified) < cutoff)
      .map(object => object.key);
    let trackedKeys = await getTrackedKeys(oldKeys);
    let orphanKeys = oldKeys.filter(key => !trackedKeys.has(key));

    if (orphanKeys.length) {
      await skillSyncObjectSweepSingleQueue.addMany(
        orphanKeys.map(key => ({ key, retentionSeconds: data.retentionSeconds }))
      );
    }

    if (page.nextContinuationToken) {
      await skillSyncObjectSweepManyQueue.add(
        {
          prefix: data.prefix,
          continuationToken: page.nextContinuationToken,
          retentionSeconds: data.retentionSeconds
        },
        dailyPacedDelay()
      );
    }
  }
);

let skillSyncObjectSweepSingleQueue = createQueue<{ key: string; retentionSeconds?: number }>({
  name: 'cargo/skill/sync/object-sweep/single',
  jobOpts: { removeOnFail: true },
  workerOpts: {
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }
  }
});

export let skillSyncObjectSweepSingleQueueProcessor = skillSyncObjectSweepSingleQueue.process(
  async data => {
    if (!isSweptKey(data.key)) return;

    await withTransaction(async () => {
      await lockSkillSyncObjects([data.key]);

      let trackedKeys = await getTrackedKeys([data.key]);
      if (trackedKeys.has(data.key)) return;

      await deleteSkillSyncObject(data.key);
    });
  }
);
