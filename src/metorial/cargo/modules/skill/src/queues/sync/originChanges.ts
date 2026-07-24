import { generatePlainId } from '@lowerdeck/id';
import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { getOriginTenant, origin } from '../../internal/skillDestination';
import { syncPropagateWaitQueue } from './propagate';

let pollIntervalMs = 5_000;
let pollLeaseMs = 30_000;
let cursorPrefix = 'cargo-skill-origin-changes';

let scheduleOriginChangePoll = async (delay = pollIntervalMs) => {
  let bucket = Math.floor((Date.now() + delay) / pollIntervalMs);
  await originChangePollQueue.add(
    {},
    {
      delay,
      id: `${cursorPrefix}:poll:${bucket}`
    }
  );
};

let enqueuePropagationReconciliation = async (originSyncId: string, jobId: string) => {
  let propagations = await db.skillDestinationSyncRepositoryPropagation.findMany({
    where: {
      originSyncId,
      status: { in: ['processing', 'waiting_for_review'] },
      skillDestinationSync: {
        status: { in: ['processing', 'waiting_for_review'] }
      }
    },
    select: {
      id: true,
      skillDestinationSync: {
        select: { id: true }
      }
    }
  });
  let bySyncId = new Map<string, string[]>();
  for (let propagation of propagations) {
    let ids = bySyncId.get(propagation.skillDestinationSync.id) ?? [];
    ids.push(propagation.id);
    bySyncId.set(propagation.skillDestinationSync.id, ids);
  }

  for (let [skillDestinationSyncId, pendingPropagationIds] of bySyncId) {
    await syncPropagateWaitQueue.add(
      {
        skillDestinationSyncId,
        pendingPropagationIds
      },
      { id: `${jobId}:${skillDestinationSyncId}` }
    );
  }
};

export let originChangeFanoutQueue = createQueue<{
  notificationId: string;
  originSyncId: string;
}>({
  name: 'cargo/skill/sync/origin-change/fanout',
  workerOpts: { concurrency: 20 }
});

export let originChangeFanoutQueueProcessor = originChangeFanoutQueue.process(async data => {
  await enqueuePropagationReconciliation(
    data.originSyncId,
    `${cursorPrefix}:notification:${data.notificationId}`
  );
});

export let originChangePollQueue = createQueue<Record<string, never>>({
  name: 'cargo/skill/sync/origin-change/poll',
  workerOpts: { concurrency: 1 }
});

let pollOriginTenant = async (resourceTenantOid: bigint) => {
  let originTenant = await getOriginTenant({
    oid: resourceTenantOid,
    id: 'origin-change-poll'
  });
  let consumer = `${cursorPrefix}:${originTenant.id}`;
  let leaseId = generatePlainId(16);
  let now = new Date();
  let leaseUntil = new Date(now.getTime() + pollLeaseMs);

  await db.skillOriginChangeNotificationCursor.upsert({
    where: { consumer },
    create: { consumer },
    update: {}
  });
  let claimed = await db.skillOriginChangeNotificationCursor.updateMany({
    where: {
      consumer,
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }]
    },
    data: { leaseId, leaseUntil }
  });
  if (claimed.count === 0) return;

  try {
    for (let page = 0; page < 5; page++) {
      let cursor = await db.skillOriginChangeNotificationCursor.findUniqueOrThrow({
        where: { consumer }
      });
      if (cursor.leaseId !== leaseId) return;

      let result = await origin.changeNotification.poll({
        tenantId: originTenant.id,
        afterCursor: cursor.cursor ?? undefined,
        limit: 100
      });

      for (let notification of result.items) {
        if (
          notification.type !== 'repository_sync_status_changed' ||
          !notification.repositorySync
        ) {
          continue;
        }
        await originChangeFanoutQueue.add(
          {
            notificationId: notification.id,
            originSyncId: notification.repositorySync.id
          },
          { id: `${cursorPrefix}:notification:${notification.id}` }
        );
      }

      await db.skillOriginChangeNotificationCursor.updateMany({
        where: { consumer, leaseId },
        data: {
          cursor: result.nextCursor ?? cursor.cursor,
          leaseUntil: new Date(Date.now() + pollLeaseMs)
        }
      });

      if (result.items.length < 100) break;
    }
  } finally {
    await db.skillOriginChangeNotificationCursor.updateMany({
      where: { consumer, leaseId },
      data: { leaseId: null, leaseUntil: null }
    });
  }
};

export let originChangePollQueueProcessor = originChangePollQueue.process(async () => {
  try {
    let activeTenants = await db.skillDestinationSyncRepositoryPropagation.findMany({
      where: {
        status: { in: ['processing', 'waiting_for_review'] },
        skillDestinationSync: {
          status: { in: ['processing', 'waiting_for_review'] }
        }
      },
      distinct: ['skillRepositoryOid'],
      select: {
        skillRepository: {
          select: { resourceTenantOid: true }
        }
      }
    });
    let tenantOids = new Set(
      activeTenants.map(propagation => propagation.skillRepository.resourceTenantOid)
    );
    for (let resourceTenantOid of tenantOids) {
      try {
        await pollOriginTenant(resourceTenantOid);
      } catch (error) {
        console.error(
          JSON.stringify({
            event: 'cargo_skill_origin_change_poll_failed',
            level: 'error',
            resourceTenantOid: resourceTenantOid.toString(),
            error: error instanceof Error ? error.message : String(error)
          })
        );
      }
    }
  } finally {
    await scheduleOriginChangePoll();
  }
});

export let originChangePollWatchdogCron = createCron(
  {
    name: 'cargo/skill/sync/origin-change/watchdog',
    cron: '* * * * *'
  },
  async () => {
    await scheduleOriginChangePoll(0);
  }
);

export let originChangeRepairCron = createCron(
  {
    name: 'cargo/skill/sync/origin-change/repair',
    cron: '*/15 * * * *'
  },
  async () => {
    let propagations = await db.skillDestinationSyncRepositoryPropagation.findMany({
      where: {
        status: { in: ['processing', 'waiting_for_review'] },
        originSyncId: { not: null },
        skillDestinationSync: {
          status: { in: ['processing', 'waiting_for_review'] }
        }
      },
      orderBy: { updatedAt: 'asc' },
      take: 500,
      select: {
        originSyncId: true
      }
    });

    for (let originSyncId of new Set(
      propagations.flatMap(propagation =>
        propagation.originSyncId ? [propagation.originSyncId] : []
      )
    )) {
      try {
        await enqueuePropagationReconciliation(
          originSyncId,
          `${cursorPrefix}:repair:${originSyncId}:${Math.floor(Date.now() / 900_000)}`
        );
        await db.skillDestinationSyncRepositoryPropagation.updateMany({
          where: {
            originSyncId,
            status: { in: ['processing', 'waiting_for_review'] }
          },
          data: { updatedAt: new Date() }
        });
      } catch (error) {
        console.error(
          JSON.stringify({
            event: 'cargo_skill_origin_change_repair_failed',
            level: 'error',
            originSyncId,
            error: error instanceof Error ? error.message : String(error)
          })
        );
      }
    }
  }
);
