import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { env } from '../../env';
import { queueJobId } from '../../lib/sessionTemplateSync';
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

export let sessionTemplateInvalidateRuntimeQueue = createQueue<{
  sessionTemplateId: string;
  cursor?: string;
}>({
  name: 'sub/ses/lc/sessionTemplate/invalidateRuntime',
  redisUrl: env.service.REDIS_URL
});

export let enqueueSessionTemplateInvalidateRuntime = async (d: {
  sessionTemplateId: string;
  cursor?: string;
}) => {
  await sessionTemplateInvalidateRuntimeQueue.add(d, {
    id: queueJobId('stir', d.sessionTemplateId, d.cursor ?? 'start')
  });
};

export let sessionTemplateInvalidateRuntimeQueueProcessor =
  sessionTemplateInvalidateRuntimeQueue.process(async data => {
    let sessionTemplate = await db.sessionTemplate.findUnique({
      where: { id: data.sessionTemplateId }
    });
    if (!sessionTemplate || sessionTemplate.status !== 'active') return;

    let ephemeralManagedSessions = await db.ephemeralManagedSession.findMany({
      where: {
        sessionTemplateOid: sessionTemplate.oid,
        status: 'active',
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true, oid: true }
    });
    if (ephemeralManagedSessions.length === 0) return;

    let now = new Date();
    let ephemeralManagedSessionOids = ephemeralManagedSessions.map(session => session.oid);
    let activeSessions = await db.session.findMany({
      where: {
        status: 'active',
        ephemeralManagedSessionOid: { in: ephemeralManagedSessionOids }
      },
      select: { oid: true }
    });

    await db.ephemeralManagedSession.updateMany({
      where: {
        oid: { in: ephemeralManagedSessionOids },
        status: 'active'
      },
      data: { willRotateAt: now }
    });

    await db.sessionProviderInstance.updateMany({
      where: {
        expiresAt: { gt: now },
        sessionOid: { in: activeSessions.map(session => session.oid) }
      },
      data: { expiresAt: now }
    });

    let lastEphemeralManagedSession =
      ephemeralManagedSessions[ephemeralManagedSessions.length - 1];
    if (!lastEphemeralManagedSession) return;

    await enqueueSessionTemplateInvalidateRuntime({
      sessionTemplateId: data.sessionTemplateId,
      cursor: lastEphemeralManagedSession.id
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
