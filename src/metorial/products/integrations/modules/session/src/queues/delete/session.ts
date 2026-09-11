import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { db } from '@metorial-subspace/db';
import { getRetentionCutoffDate } from '@metorial-subspace/list-utils';
import { env } from '../../env';
import { sessionDeletedQueue } from '../lifecycle/session';
import { getCutoffDate, RETENTION_BATCH_SIZE } from './_config';
import { deleteProviderRunsBySessionOid } from './providerRunCleanup';

export let sessionRetentionCleanupCron = createCron(
  {
    name: 'sub/ses/ret/cleanup/cron',
    cron: '0 0 * * *',
    redisUrl: env.service.REDIS_URL
  },
  async () => {
    await sessionRetentionTenantSearchQueue.add(
      {},
      { id: 'session-retention-cleanup-search' }
    );
  }
);

export let sessionRetentionTenantSearchQueue = createQueue<{ cursor?: string }>({
  name: 'sub/ses/ret/cleanup/search',
  redisUrl: env.service.REDIS_URL
});

export let sessionRetentionTenantSearchQueueProcessor =
  sessionRetentionTenantSearchQueue.process(async data => {
    let tenants = await db.tenant.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RETENTION_BATCH_SIZE,
      select: { id: true }
    });
    if (tenants.length === 0) return;

    await sessionRetentionTenantQueue.addMany(
      tenants.map(tenant => ({ tenantId: tenant.id }))
    );

    let lastTenant = tenants[tenants.length - 1];
    if (!lastTenant) return;

    await sessionRetentionTenantSearchQueue.add({
      cursor: lastTenant.id
    });
  });

export let sessionRetentionTenantQueue = createQueue<{ tenantId: string }>({
  name: 'sub/ses/ret/cleanup/tenant',
  redisUrl: env.service.REDIS_URL
});

export let sessionRetentionTenantQueueProcessor = sessionRetentionTenantQueue.process(
  async data => {
    let tenant = await db.tenant.findUnique({
      where: { id: data.tenantId },
      select: {
        oid: true,
        logRetentionInDays: true,
        enforceSessionExpiry: true
      }
    });
    if (!tenant) return;

    await sessionDeleteManyQueue.add({
      tenantOid: tenant.oid,
      logRetentionInDays: tenant.logRetentionInDays,
      enforceSessionExpiry: tenant.enforceSessionExpiry
    });
  }
);

export let sessionDeleteManyQueue = createQueue<{
  tenantOid: bigint;
  logRetentionInDays: number;
  enforceSessionExpiry: boolean;
  cursor?: string;
}>({
  name: 'sub/ses/delete/session/many',
  redisUrl: env.service.REDIS_URL
});

export let enqueueArchivedSessionDeletes = async (d: {
  tenantOid: bigint;
  logRetentionInDays: number;
  enforceSessionExpiry: boolean;
  cursor?: string;
}) => {
  let archivedBefore = d.enforceSessionExpiry
    ? getRetentionCutoffDate(d.logRetentionInDays)
    : getCutoffDate();

  let sessions = await db.session.findMany({
    where: {
      tenantOid: d.tenantOid,
      status: 'archived',
      archivedAt: { lt: archivedBefore },
      id: d.cursor ? { gt: d.cursor } : undefined
    },
    orderBy: { id: 'asc' },
    take: RETENTION_BATCH_SIZE,
    select: { id: true }
  });
  if (sessions.length === 0) return;

  await sessionDeleteQueue.addMany(sessions.map(session => ({ sessionId: session.id })));

  let lastSession = sessions[sessions.length - 1];
  if (!lastSession) return;

  await sessionDeleteManyQueue.add({
    tenantOid: d.tenantOid,
    logRetentionInDays: d.logRetentionInDays,
    enforceSessionExpiry: d.enforceSessionExpiry,
    cursor: lastSession.id
  });
};

export let sessionDeleteManyQueueProcessor = sessionDeleteManyQueue.process(async data => {
  await enqueueArchivedSessionDeletes(data);
});

export let sessionDeleteQueue = createQueue<{ sessionId: string }>({
  name: 'sub/ses/delete/session',
  redisUrl: env.service.REDIS_URL
});

export let sessionDeleteQueueProcessor = sessionDeleteQueue.process(async data => {
  let session = await db.session.findUnique({
    where: { id: data.sessionId }
  });
  if (!session || session.status !== 'archived') return;

  await db.sessionProvider.updateMany({
    where: { sessionOid: session.oid },
    data: { status: 'deleted', isParentDeleted: true }
  });
  await db.sessionConnection.updateMany({
    where: { sessionOid: session.oid },
    data: {
      status: 'deleted',
      isParentDeleted: true,
      state: 'disconnected',
      disconnectedAt: new Date()
    }
  });
  await db.providerRun.updateMany({
    where: { sessionOid: session.oid },
    data: {
      status: 'stopped',
      isParentDeleted: true,
      completedAt: new Date()
    }
  });
  await db.toolCall.deleteMany({
    where: { sessionOid: session.oid }
  });
  await db.sessionEvent.deleteMany({
    where: { sessionOid: session.oid }
  });
  await db.sessionMessage.deleteMany({
    where: { sessionOid: session.oid }
  });
  await db.sessionWarning.deleteMany({
    where: { sessionOid: session.oid }
  });
  await db.sessionError.deleteMany({
    where: { sessionOid: session.oid }
  });
  await deleteProviderRunsBySessionOid(session.oid);
  await db.sessionProviderInstance.deleteMany({
    where: { sessionOid: session.oid }
  });
  await db.sessionUsageRecord.deleteMany({
    where: { sessionOid: session.oid }
  });

  await db.session.updateMany({
    where: { oid: session.oid },
    data: {
      status: 'deleted',
      name: '[deleted]',
      description: null,
      metadata: {},
      sharedProviderName: null,
      sharedProviderDescription: null,
      hasErrors: false,
      hasWarnings: false,
      isStarted: false,
      connectionState: 'disconnected',
      totalProductiveClientMessageCount: 0,
      totalProductiveProviderMessageCount: 0
    }
  });

  await sessionDeletedQueue.add({ sessionId: session.id });
});
