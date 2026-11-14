import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';

let daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

export let cleanupAuditLogStreamRunsCron = createCron(
  {
    name: 'audit/stream/run/cleanup',
    cron: '0 0 * * *'
  },
  async () => {
    await db.auditLogStreamRun.deleteMany({
      where: {
        OR: [
          {
            status: { not: 'error' },
            createdAt: { lt: daysAgo(1) }
          },
          {
            status: 'error',
            createdAt: { lt: daysAgo(14) }
          }
        ]
      }
    });
  }
);
