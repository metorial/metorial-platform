import { createCron } from '@lowerdeck/cron';
import { createLock } from '@lowerdeck/lock';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { createUpstreamClient, UpstreamRequestError } from '../../lib/mirror/upstreamClient';
import { isMirrorMode } from '../../mode';
import { mirrorService } from '../../services/mirror';
import { mirrorImportService } from '../../services/mirrorImport';

let feedPageSize = 100;

let upstreamPageSize = 100;

let nextPageDelayMs = 1000;

let maxErrorLength = 1000;

export let mirrorSyncCron = createCron(
  {
    name: 'sreg/mirror/sync/cron',
    cron: '* * * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    if (!isMirrorMode()) return;

    await mirrorSyncAllQueue.add({}, { deduplication: { id: 'mirror-sync-all' } });
  }
);

export let mirrorSyncAllQueue = createQueue<{ cursor?: string }>({
  name: 'sreg/mirror/sync/all',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 1 }
});

export let mirrorSyncAllProcessor = mirrorSyncAllQueue.process(async data => {
  if (!(await mirrorService.canSync())) return;

  let upstreams = await db.mirrorUpstream.findMany({
    where: { status: 'active', id: data.cursor ? { gt: data.cursor } : undefined },
    orderBy: { id: 'asc' },
    take: upstreamPageSize,
    select: { id: true }
  });
  if (!upstreams.length) return;

  await mirrorSyncUpstreamQueue.addManyWithOps(
    upstreams.map(upstream => ({
      data: { upstreamId: upstream.id },
      opts: { deduplication: { id: `mirror-sync-${upstream.id}` } }
    }))
  );

  if (upstreams.length === upstreamPageSize) {
    await mirrorSyncAllQueue.add({ cursor: upstreams[upstreams.length - 1]!.id });
  }
});

export let mirrorSyncUpstreamQueue = createQueue<{ upstreamId: string }>({
  name: 'sreg/mirror/sync/upstream',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 2 }
});

let upstreamLock = createLock({
  name: 'sreg/mirror/sync/lock',
  redisUrl: env.service.REDIS_URL
});

export let mirrorSyncUpstreamProcessor = mirrorSyncUpstreamQueue.process(async data =>
  upstreamLock.usingLock(data.upstreamId, async () => {
    if (!(await mirrorService.canSync())) return;

    let upstream = await db.mirrorUpstream.findUnique({ where: { id: data.upstreamId } });
    if (upstream?.status !== 'active') return;

    let items;
    try {
      ({ items } = await createUpstreamClient(upstream).listChangeNotifications({
        after: upstream.changeNotificationCursor,
        limit: feedPageSize
      }));
    } catch (error) {
      await db.mirrorUpstream.update({
        where: { oid: upstream.oid },
        data: {
          lastSyncError: (error instanceof Error ? error.message : String(error)).slice(
            0,
            maxErrorLength
          ),
          lastSyncErrorAt: new Date()
        }
      });
      return;
    }

    let versions = items.flatMap(item =>
      item.slateVersion?.identifier
        ? [{ identifier: item.slate.fullIdentifier, version: item.slateVersion.identifier }]
        : []
    );

    if (versions.length) {
      await mirrorImportUpstreamVersionQueue.addManyWithOps(
        versions.map(version => ({
          data: { upstreamId: upstream.id, ...version },
          opts: {
            deduplication: {
              id: `mirror-import-${upstream.id}-${version.identifier}-${version.version}`
            }
          }
        }))
      );
    }

    await db.mirrorUpstream.update({
      where: { oid: upstream.oid },
      data: {
        changeNotificationCursor: items.length
          ? items[items.length - 1]!.id
          : upstream.changeNotificationCursor,
        lastSyncedAt: new Date(),
        lastSyncError: null,
        lastSyncErrorAt: null
      }
    });

    if (items.length === feedPageSize) {
      await mirrorSyncUpstreamQueue.add(
        { upstreamId: upstream.id },
        { delay: nextPageDelayMs }
      );
    }
  })
);

export let mirrorImportUpstreamVersionQueue = createQueue<{
  upstreamId: string;
  identifier: string;
  version: string;
}>({
  name: 'sreg/mirror/import/upstream',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 2, limiter: { max: 10, duration: 1000 } }
});

export let mirrorImportUpstreamVersionProcessor = mirrorImportUpstreamVersionQueue.process(
  async data => {
    if (!(await mirrorService.canSync())) return;

    let upstream = await db.mirrorUpstream.findUnique({ where: { id: data.upstreamId } });
    if (upstream?.status !== 'active') return;

    let alreadyImported = await db.slateVersion.findFirst({
      where: { version: data.version, slate: { fullIdentifier: data.identifier } },
      select: { oid: true }
    });
    if (alreadyImported) return;

    let client = createUpstreamClient(upstream);

    let slate, version, bundle;
    try {
      slate = await client.getSlate(data.identifier);
      version = await client.getSlateVersion(data.identifier, data.version);
      bundle = await client.downloadSlateVersion(data.identifier, data.version);
    } catch (error) {
      // Gone from the upstream view (filtered or deleted): nothing to mirror.
      if (error instanceof UpstreamRequestError && error.status === 404) return;
      throw error;
    }

    await mirrorImportService.importVerifiedSlateVersion({
      source: { type: 'upstream', upstream },
      identifier: data.identifier,
      version: version.version,
      bundle,
      signatures: version.signatures ?? [],
      catalog: { name: slate.name, description: slate.description, logoUrl: slate.logoUrl }
    });
  }
);
