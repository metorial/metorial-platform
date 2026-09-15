import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';

export let delegatedContentCacheCleanupCron = createCron(
  {
    name: 'cargo/file/delegatedContentCache/cleanup/cron',
    cron: '*/15 * * * *'
  },
  async () => {
    await db.file.updateMany({
      where: {
        delegatedContentUrlExpiresAt: {
          lte: new Date()
        }
      },
      data: {
        delegatedContentUrl: null,
        delegatedContentUrlExpiresAt: null
      }
    });
  }
);
