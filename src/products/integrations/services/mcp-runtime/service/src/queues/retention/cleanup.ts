import { createObjectDeleteQueue } from '@lowerdeck/queue';
import { createRetentionRunner, retentionPhaseBatch } from '@lowerdeck/retention-runner';
import { subDays } from 'date-fns';
import { ServerDeploymentStatus } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { connectionLogsBucketRecord, storage } from '../../storage';
import {
  getRetentionCutoffDate,
  RETENTION_BATCH_SIZE,
  retentionCleanupWorkerOpts,
  SERVER_DISCOVERY_RETENTION_DAYS
} from './_config';

let enqueueStorageDeletes = async (keys: string[]) => {
  await shuttleRetentionStorageCleanupQueue.enqueue(connectionLogsBucketRecord.bucket, keys);
};

interface ShuttleRetentionTenant {
  tenantOid: bigint;
  cutoffDate: Date;
  discoveryCutoffDate: Date;
}

let shuttleRetentionRunner = createRetentionRunner<ShuttleRetentionTenant>({
  name: 'shut/ret',
  redisUrl: env.service.REDIS_URL,
  cron: '0 0 * * *',
  tenantWorkerOpts: retentionCleanupWorkerOpts,

  listTenants: ({ cursor, take }) =>
    db.tenant.findMany({
      where: { id: cursor ? { gt: cursor } : undefined },
      orderBy: { id: 'asc' },
      take,
      select: { id: true }
    }),

  getTenant: async tenantId => {
    let tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { oid: true, logRetentionInDays: true }
    });
    if (!tenant) return null;

    let cutoffDate = getRetentionCutoffDate(tenant.logRetentionInDays);

    return {
      tenantOid: tenant.oid,
      cutoffDate,
      // Discovery records are diagnostic and capped at `SERVER_DISCOVERY_RETENTION_DAYS`
      // regardless of the tenant's (longer) log retention window.
      discoveryCutoffDate: new Date(
        Math.max(
          cutoffDate.getTime(),
          subDays(new Date(), SERVER_DISCOVERY_RETENTION_DAYS).getTime()
        )
      )
    };
  },

  phases: {
    // The only phase that doesn't delete what it reads — the rows stay, the objects go — so it
    // carries a cursor to make forward progress.
    connectionLogStorage: async (d, cursor) => {
      let records = await db.serverConnection.findMany({
        where: {
          tenantOid: d.tenantOid,
          status: 'disconnected',
          isLogsInStorage: true,
          createdAt: { lt: d.cutoffDate },
          id: cursor ? { gt: cursor } : undefined
        },
        orderBy: { id: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { id: true }
      });
      if (records.length === 0) return { hasMore: false };

      await enqueueStorageDeletes(records.map(record => `logs/${record.id}/data`));

      return {
        hasMore: records.length === RETENTION_BATCH_SIZE,
        cursor: records[records.length - 1]!.id
      };
    },

    connectionLogRows: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.serverConnectionLogsTemp.findMany({
            where: {
              serverConnection: { tenantOid: d.tenantOid },
              createdAt: { lt: d.cutoffDate }
            },
            orderBy: { createdAt: 'asc' },
            take: RETENTION_BATCH_SIZE,
            select: { oid: true }
          }),
        deleteMany: records =>
          db.serverConnectionLogsTemp.deleteMany({
            where: { oid: { in: records.map(record => record.oid) } }
          })
      }),

    functionInvocations: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.functionServerInvocation.findMany({
            where: {
              tenantOid: d.tenantOid,
              createdAt: { lt: d.cutoffDate }
            },
            orderBy: { createdAt: 'asc' },
            take: RETENTION_BATCH_SIZE,
            select: { oid: true }
          }),
        deleteMany: records =>
          db.functionServerInvocation.deleteMany({
            where: { oid: { in: records.map(record => record.oid) } }
          })
      }),

    serverDiscoveries: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.serverDiscovery.findMany({
            where: {
              tenantOid: d.tenantOid,
              createdAt: { lt: d.discoveryCutoffDate }
            },
            orderBy: { createdAt: 'asc' },
            take: RETENTION_BATCH_SIZE,
            select: { oid: true }
          }),
        deleteMany: records =>
          db.serverDiscovery.deleteMany({
            where: { oid: { in: records.map(record => record.oid) } }
          })
      }),

    serverAuthConfigEvents: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.serverAuthConfigEvent.findMany({
            where: {
              serverAuthConfig: { tenantOid: d.tenantOid },
              createdAt: { lt: d.cutoffDate }
            },
            orderBy: { createdAt: 'asc' },
            take: RETENTION_BATCH_SIZE,
            select: { oid: true }
          }),
        deleteMany: records =>
          db.serverAuthConfigEvent.deleteMany({
            where: { oid: { in: records.map(record => record.oid) } }
          })
      }),

    serverOAuthSetupEvents: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.serverOAuthSetupEvent.findMany({
            where: {
              serverOAuthSetup: { tenantOid: d.tenantOid },
              createdAt: { lt: d.cutoffDate }
            },
            orderBy: { createdAt: 'asc' },
            take: RETENTION_BATCH_SIZE,
            select: { oid: true }
          }),
        deleteMany: records =>
          db.serverOAuthSetupEvent.deleteMany({
            where: { oid: { in: records.map(record => record.oid) } }
          })
      }),

    deploymentSteps: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.serverDeploymentStep.findMany({
            where: {
              deployment: { tenantOid: d.tenantOid },
              createdAt: { lt: d.cutoffDate }
            },
            orderBy: { createdAt: 'asc' },
            take: RETENTION_BATCH_SIZE,
            select: { oid: true }
          }),
        deleteMany: records =>
          db.serverDeploymentStep.deleteMany({
            where: { oid: { in: records.map(record => record.oid) } }
          })
      }),

    deployments: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.serverDeployment.findMany({
            where: {
              tenantOid: d.tenantOid,
              status: {
                in: [ServerDeploymentStatus.succeeded, ServerDeploymentStatus.failed]
              },
              createdAt: { lt: d.cutoffDate },
              serverVersion: { is: null }
            },
            orderBy: { createdAt: 'asc' },
            take: RETENTION_BATCH_SIZE,
            select: { oid: true }
          }),
        deleteMany: records =>
          db.serverDeployment.deleteMany({
            where: { oid: { in: records.map(record => record.oid) } }
          })
      })
  }
});

export let shuttleRetentionCron = shuttleRetentionRunner.cron;
export let shuttleTenantRetentionSearchQueue = shuttleRetentionRunner.searchQueue;
export let shuttleTenantRetentionCleanupQueue = shuttleRetentionRunner.tenantQueue;
export let shuttleRetentionProcessors = shuttleRetentionRunner.processors;

export let shuttleRetentionStorageCleanupQueue = createObjectDeleteQueue({
  name: 'shut/ret/storage/object',
  redisUrl: env.service.REDIS_URL,
  deleteObject: (bucket, key) => storage.deleteObject(bucket, key)
});

export let shuttleRetentionStorageCleanupQueueProcessor =
  shuttleRetentionStorageCleanupQueue.processor;
