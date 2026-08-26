import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { subDays } from 'date-fns';

export let skillDestinationSyncCleanupCron = createCron(
  {
    name: 'cargo/skill/sync/cleanup/cron',
    cron: '0 0 * * *'
  },
  async () => {
    let twoWeeksAgo = subDays(new Date(), 14);

    await db.skillDestinationSync.deleteMany({
      where: {
        createdAt: {
          lt: twoWeeksAgo
        }
      }
    });
  }
);

/**
 * Tombstones exist only until every linked repository has propagated past them,
 * and a destination with no linked repository never advances a cursor at all, so
 * they need the same horizon the sync history uses. A repository that has been
 * failing for longer than this stops catching up on those deletions and needs
 * manual attention anyway.
 */
export let skillDestinationDeletedFileCleanupCron = createCron(
  {
    name: 'cargo/skill/sync/deletedFiles/cleanup/cron',
    cron: '0 0 * * *'
  },
  async () => {
    await db.skillDestinationDeletedFile.deleteMany({
      where: {
        createdAt: {
          lt: subDays(new Date(), 14)
        }
      }
    });
  }
);
