import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { db, snowflake } from '@metorial-subspace/db';
import { env } from '../../env';
import { origin } from '../../origin';
import { handlePushQueue } from './handlePush';

export let scmSyncManyQueue = createQueue<{}>({
  name: 'sub/cpr/scm/sync/many',
  redisUrl: env.service.REDIS_URL
});

let lock = createLock({
  name: 'sub/cpr/scm/sync/many/lock',
  redisUrl: env.service.REDIS_URL
});

let CURSOR_ID = 1;

export let scmSyncManyQueueProcessor = scmSyncManyQueue.process(async data =>
  lock.usingLock('1', async () => {
    let changeNotification = await db.originSyncChangeNotificationCursor.findFirst({
      where: { id: CURSOR_ID }
    });
    if (!changeNotification) throw new QueueRetryError();

    let changeNotifications = await origin.changeNotification.list({
      limit: 100,
      after: changeNotification.cursor,
      order: 'asc'
    });
    if (!changeNotifications.items.length) return;

    let repos = await db.scmRepo.findMany({
      where: {
        id: {
          in: changeNotifications.items.map(i => i.repoPush?.repo?.id!).filter(Boolean)
        }
      }
    });
    let repoMap = new Map(repos.map(t => [t.id, t]));

    let pushes = await db.scmRepoPush.createManyAndReturn({
      skipDuplicates: true,
      select: { id: true },
      data: changeNotifications.items
        .map(item => {
          if (item.type !== 'repo_push' || !item.repoPush?.repo) return undefined!;
          let repo = repoMap.get(item.repoPush.repo.id);
          if (!repo) return undefined!;

          return {
            oid: snowflake.nextId(),
            id: item.id,

            pusherName: item.repoPush?.pusherName,
            pusherEmail: item.repoPush?.pusherEmail,
            senderIdentifier: item.repoPush?.senderIdentifier,
            commitMessage: item.repoPush?.commitMessage,

            branchName: item.repoPush?.branchName,
            sha: item.repoPush?.sha,

            repoOid: repo.oid,
            tenantOid: repo.tenantOid,
            solutionOid: repo.solutionOid
          };
        })
        .filter(Boolean)
    });

    await handlePushQueue.addMany(
      pushes.map(item => ({
        scmRepoPushId: item.id
      }))
    );

    let lastItem = changeNotifications.items[changeNotifications.items.length - 1];
    if (!lastItem) return;

    await db.originSyncChangeNotificationCursor.upsert({
      where: { id: CURSOR_ID },
      create: { id: CURSOR_ID, cursor: lastItem.id },
      update: { cursor: lastItem.id }
    });
  })
);
