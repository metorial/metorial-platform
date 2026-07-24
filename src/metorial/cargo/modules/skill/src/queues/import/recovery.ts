import { createCron } from '@metorial/cron';
import { db } from '@metorial/db';
import { skillImportAcquireQueue } from './acquire';
import { skillImportItemQueue } from './item';

let staleAfterMs = 30 * 60 * 1000;

export let skillImportRecoveryCron = createCron(
  {
    name: 'cargo/skill/import/recovery',
    cron: '*/5 * * * *'
  },
  async () => {
    let staleBefore = new Date(Date.now() - staleAfterMs);
    let staleItems = await db.skillImportItem.findMany({
      where: {
        status: 'processing',
        skillImport: { status: 'processing' },
        OR: [
          { heartbeatAt: { lt: staleBefore } },
          { heartbeatAt: null, startedAt: { lt: staleBefore } }
        ]
      },
      select: {
        id: true,
        skillImport: { select: { id: true } }
      }
    });

    for (let item of staleItems) {
      await db.skillImportItem.updateMany({
        where: { id: item.id, status: 'processing' },
        data: {
          status: 'failed',
          error: 'Skill import item timed out',
          completedAt: new Date()
        }
      });
      await skillImportItemQueue.add({ skillImportItemId: item.id });
    }

    let failedItemsNeedingCleanup = await db.skillImportItem.findMany({
      where: {
        status: 'failed',
        cleanupCompletedAt: null
      },
      select: { id: true }
    });
    for (let item of failedItemsNeedingCleanup) {
      await skillImportItemQueue.add({ skillImportItemId: item.id });
    }

    let abandonedPendingImports = await db.skillImport.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) }
      },
      select: { id: true }
    });
    for (let skillImport of abandonedPendingImports) {
      await skillImportAcquireQueue.add({ skillImportId: skillImport.id });
    }

    let abandonedPendingItems = await db.skillImportItem.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
        skillImport: { status: 'processing' }
      },
      select: { id: true }
    });
    for (let item of abandonedPendingItems) {
      await skillImportItemQueue.add({ skillImportItemId: item.id });
    }

    let staleDiscoveryImports = await db.skillImport.findMany({
      where: {
        status: 'processing',
        startedAt: { lt: staleBefore },
        items: { none: {} }
      },
      select: { id: true }
    });
    for (let skillImport of staleDiscoveryImports) {
      await db.skillImport.updateMany({
        where: { id: skillImport.id, status: 'processing' },
        data: {
          status: 'failed',
          error: 'Skill import discovery timed out',
          completedAt: new Date()
        }
      });
    }
  }
);
