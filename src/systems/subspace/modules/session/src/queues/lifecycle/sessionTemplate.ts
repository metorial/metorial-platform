import { createQueue } from '@mtsrc/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { sessionArchivedQueue } from './session';

export let sessionTemplateArchivedQueue = createQueue<{
  sessionTemplateId: string;
}>({
  name: 'sub/ses/lc/sessionTemplate/archived',
  redisUrl: env.service.REDIS_URL
});

export let sessionTemplateArchivedQueueProcessor = sessionTemplateArchivedQueue.process(
  async data => {
    let sessionTemplate = await db.sessionTemplate.findUnique({
      where: { id: data.sessionTemplateId }
    });
    if (!sessionTemplate || sessionTemplate.status !== 'archived') return;

    await sessionTemplateArchiveSessionsManyQueue.add({
      sessionTemplateId: data.sessionTemplateId
    });
  }
);

export let sessionTemplateArchiveSessionsManyQueue = createQueue<{
  sessionTemplateId: string;
  cursor?: string;
}>({
  name: 'sub/ses/lc/sessionTemplate/archiveSessionsMany',
  redisUrl: env.service.REDIS_URL
});

export let sessionTemplateArchiveSessionsManyQueueProcessor =
  sessionTemplateArchiveSessionsManyQueue.process(async data => {
    let sessionTemplate = await db.sessionTemplate.findUnique({
      where: { id: data.sessionTemplateId }
    });
    if (!sessionTemplate || sessionTemplate.status !== 'archived') return;

    let archivedAt = sessionTemplate.archivedAt ?? new Date();

    let sessions = await db.session.findMany({
      where: {
        status: 'active',
        providers: {
          some: {
            fromTemplateOid: sessionTemplate.oid
          }
        },
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (sessions.length === 0) return;

    await db.sessionProvider.updateMany({
      where: {
        sessionOid: { in: sessions.map(session => session.oid) },
        status: 'active'
      },
      data: {
        status: 'archived'
      }
    });

    await db.session.updateMany({
      where: {
        oid: { in: sessions.map(session => session.oid) },
        status: 'active'
      },
      data: {
        status: 'archived',
        archivedAt,
        connectionState: 'disconnected'
      }
    });

    await sessionArchivedQueue.addMany(
      sessions.map(session => ({
        sessionId: session.id
      }))
    );

    let lastSession = sessions[sessions.length - 1];
    if (!lastSession) return;

    await sessionTemplateArchiveSessionsManyQueue.add({
      sessionTemplateId: data.sessionTemplateId,
      cursor: lastSession.id
    });
  });

export let sessionTemplateDeletedQueue = createQueue<{
  sessionTemplateId: string;
}>({
  name: 'sub/ses/lc/sessionTemplate/deleted',
  redisUrl: env.service.REDIS_URL
});

export let sessionTemplateDeletedQueueProcessor = sessionTemplateDeletedQueue.process(
  async () => {}
);
