import { createCron } from '@mtsrc/cron';
import { createQueue } from '@mtsrc/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { sessionTemplateDeletedQueue } from '../lifecycle/sessionTemplate';
import { getCutoffDate } from './_config';

export let sessionTemplateArchivedCleanupCron = createCron(
  {
    name: 'sub/ses/cron/sessionTemplateArchivedCleanup',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await sessionTemplateDeleteManyQueue.add({}, { id: 'many' });
  }
);

export let sessionTemplateDeleteManyQueue = createQueue<{ cursor?: string }>({
  name: 'sub/ses/delete/sessionTemplate/many',
  redisUrl: env.service.REDIS_URL
});

export let sessionTemplateDeleteManyQueueProcessor = sessionTemplateDeleteManyQueue.process(
  async data => {
    let sessionTemplates = await db.sessionTemplate.findMany({
      where: {
        status: 'archived',
        archivedAt: { lt: getCutoffDate() },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (sessionTemplates.length === 0) return;

    await sessionTemplateDeleteQueue.addMany(
      sessionTemplates.map(sessionTemplate => ({
        sessionTemplateId: sessionTemplate.id
      }))
    );

    let lastSessionTemplate = sessionTemplates[sessionTemplates.length - 1];
    if (!lastSessionTemplate) return;

    await sessionTemplateDeleteManyQueue.add({
      cursor: lastSessionTemplate.id
    });
  }
);

export let sessionTemplateDeleteQueue = createQueue<{
  sessionTemplateId: string;
}>({
  name: 'sub/ses/delete/sessionTemplate',
  redisUrl: env.service.REDIS_URL
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
