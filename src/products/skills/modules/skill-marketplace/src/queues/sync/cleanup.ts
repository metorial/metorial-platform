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
        status: { in: ['completed', 'canceled', 'failed'] },
        repositoryPropagations: {
          none: { status: { in: ['pending', 'processing', 'waiting_for_review'] } }
        },
        createdAt: {
          lt: twoWeeksAgo
        }
      }
    });
  }
);

export let skillDestinationDeletedFileCleanupCron = createCron(
  {
    name: 'cargo/skill/sync/deletedFiles/cleanup/cron',
    cron: '0 0 * * *',
    startupJitterMs: 30_000
  },
  async () => {
    let cutoff = subDays(new Date(), 14);

    // Age alone is insufficient: disconnected or stalled repositories can still need
    // these deletions when they recover. Keep them until every current link caught up.
    await db.skillDestinationDeletedFile.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        destination: {
          OR: [
            {
              skillMarketplace: {
                repositories: {
                  every: {
                    skillRepository: { deletionsAppliedAt: { not: null, gte: cutoff } }
                  }
                }
              }
            },
            {
              skillPlugin: {
                repositories: {
                  every: {
                    skillRepository: { deletionsAppliedAt: { not: null, gte: cutoff } }
                  }
                }
              }
            }
          ]
        }
      }
    });
  }
);
