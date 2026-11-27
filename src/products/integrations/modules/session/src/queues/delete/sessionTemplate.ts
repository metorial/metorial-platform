import {
  archivedCleanupFindArgs,
  archivedCleanupWhere,
  archivedCleanupWorkerOpts,
  createArchivedCleanupScan
} from '@metorial-subspace/archived-cleanup';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { sessionTemplateDeletedQueue } from '../lifecycle/sessionTemplate';

let sessionTemplateArchivedCleanup = createArchivedCleanupScan({
  cronName: 'sub/ses/cron/sessionTemplateArchivedCleanup',
  cron: '0 0 * * *',
  manyQueueName: 'sub/ses/delete/sessionTemplate/many',
  redisUrl: env.service.REDIS_URL,
  findArchived: ({ cursor, take }) =>
    db.sessionTemplate.findMany({
      where: archivedCleanupWhere({ cursor }),
      ...archivedCleanupFindArgs({ cursor, take })
    }),
  enqueue: ids => sessionTemplateDeleteQueue.addMany(ids.map(id => ({ sessionTemplateId: id })))
});

export let sessionTemplateArchivedCleanupCron = sessionTemplateArchivedCleanup.cron;
export let sessionTemplateDeleteManyQueue = sessionTemplateArchivedCleanup.manyQueue;
export let sessionTemplateDeleteManyQueueProcessor = sessionTemplateArchivedCleanup.manyProcessor;

export let sessionTemplateDeleteQueue = createQueue<{
  sessionTemplateId: string;
}>({
  name: 'sub/ses/delete/sessionTemplate',
  redisUrl: env.service.REDIS_URL,
  workerOpts: archivedCleanupWorkerOpts()
});

export let sessionTemplateDeleteQueueProcessor = sessionTemplateDeleteQueue.process(
  async data => {
    let sessionTemplate = await db.sessionTemplate.findUnique({
      where: { id: data.sessionTemplateId }
    });
    if (!sessionTemplate || sessionTemplate.status !== 'archived') return;

    await db.sessionTemplateProvider.updateMany({
      where: { sessionTemplateOid: sessionTemplate.oid },
      data: { status: 'deleted' }
    });

    await db.sessionTemplate.updateMany({
      where: { oid: sessionTemplate.oid },
      data: {
        status: 'deleted',
        isInternal: false,
        name: '[deleted]',
        description: null,
        metadata: {}
      }
    });

    await sessionTemplateDeletedQueue.add({
      sessionTemplateId: sessionTemplate.id
    });
  }
);
