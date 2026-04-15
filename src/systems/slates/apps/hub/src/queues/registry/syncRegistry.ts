import { createLock } from '@lowerdeck/lock';
import { createQueue } from '@lowerdeck/queue';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { getRegistryClient, getRegistryQuery } from '../../registry';
import { syncSlateQueue } from './syncSlate';

export let syncRegistryQueue = createQueue<{
  registryId: string;
}>({
  name: 'shub/reg/sync',
  redisUrl: env.service.REDIS_URL
});

let lock = createLock({
  name: 'shub/reg/sync/lock',
  redisUrl: env.service.REDIS_URL
});

export let syncRegistryQueueProcessor = syncRegistryQueue.process(data =>
  lock.usingLock(data.registryId, async () => {
    let reg = await db.registry.findUnique({
      where: { id: data.registryId }
    });
    if (!reg) return;

    let client = await getRegistryClient(reg);

    let changeNotifications = await client['change-notifications'].$get({
      query: {
        limit: '100',
        after: reg.changeNotificationCursor ?? undefined,
        order: 'asc',
        ...getRegistryQuery()
      }
    });
    if (changeNotifications.status !== 200) return;

    let { items } = (await changeNotifications.json()) as {
      items: Array<{
        id: string;
        slate: { fullIdentifier: string };
        slateVersion?: { identifier?: string | null; id?: string | null };
      }>;
    };
    console.log(`Syncing ${items.length} items for registry ${reg.id}`);
    if (items.length === 0) return;

    await syncSlateQueue.addManyWithOps(
      items.map(s => ({
        data: {
          id: s.slate.fullIdentifier,
          version: s.slateVersion?.identifier ?? undefined,
          registryId: reg.id
        },
        opts: {
          id: s.id
        }
      }))
    );

    await db.registrySync.create({
      data: {
        ...getId('registrySync'),
        registryOid: reg.oid,

        slatesSyncedIds: items.map(i => i.slate.fullIdentifier),
        slateVersionsSyncedIds: items.map(i => i.slateVersion?.id!).filter(Boolean)
      }
    });

    await db.registry.update({
      where: { id: reg.id },
      data: {
        changeNotificationCursor: items[items.length - 1]?.id,
        lastSyncedAt: new Date()
      }
    });

    await syncRegistryQueue.add({ registryId: reg.id }, { id: reg.id });
  })
);
