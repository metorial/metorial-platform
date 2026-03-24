import { createQueue } from '@metorial/queue';
import { cell } from '../../cell';
import { globalDB } from '../../db';
import { syncOAuthAppToDeploymentQueue } from './oauth';
import { syncUserToDeploymentQueue } from './user';

let syncToDeploymentQueue = createQueue({
  name: 'global/sync/to-deployment'
});

export let syncToDeploymentQueueProcessor = syncToDeploymentQueue.process(async () => {
  let currentCell = await globalDB.cell.findFirstOrThrow({
    where: { oid: (await cell).oid }
  });

  let startTime = currentCell.lastSyncRangeEnd ?? new Date(0);
  let endTime = new Date();

  let timeRange = { gt: startTime, lte: endTime };

  let userCursor: string | undefined = undefined;
  while (true) {
    let users = await globalDB.user.findMany({
      where: {
        id: { gt: userCursor },
        updatedAt: timeRange,
        lastEditByOid: { not: currentCell.oid }
      },
      orderBy: { id: 'asc' },
      take: 100
    });
    if (users.length === 0) break;

    await syncUserToDeploymentQueue.addMany(users.map(user => ({ user })));

    userCursor = users[users.length - 1].id as string;
  }

  let oAuthAppCursor: string | undefined = undefined;
  while (true) {
    let oAuthApps = await globalDB.oAuthApplication.findMany({
      where: {
        id: { gt: oAuthAppCursor },
        updatedAt: timeRange,
        ownerOid: { not: currentCell.oid }
      },
      orderBy: { id: 'asc' },
      take: 100,
      include: { clientSecrets: true }
    });
    if (oAuthApps.length === 0) break;

    await syncOAuthAppToDeploymentQueue.addMany(oAuthApps.map(app => ({ app })));

    oAuthAppCursor = oAuthApps[oAuthApps.length - 1].id as string;
  }

  await globalDB.cell.updateMany({
    where: { oid: currentCell.oid },
    data: { lastSyncRangeStart: startTime, lastSyncRangeEnd: endTime }
  });

  await syncToDeploymentQueue.add({}, { delay: 1000, id: 'sync' });
});

syncToDeploymentQueue.add({}, { id: 'sync' });
