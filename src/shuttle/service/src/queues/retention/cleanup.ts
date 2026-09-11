import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { ServerDeploymentStatus } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { connectionLogsBucketRecord, storage } from '../../storage';
import {
  getRetentionCutoffDate,
  RETENTION_BATCH_SIZE,
  retentionCleanupWorkerOpts,
  retentionStorageCleanupWorkerOpts
} from './_config';

type StorageCleanupRecord = {
  key: string;
};

let processBatch = async <T>(d: {
  findMany: () => Promise<T[]>;
  beforeDelete?: (records: T[]) => Promise<void>;
  deleteMany: (records: T[]) => Promise<unknown>;
}) => {
  while (true) {
    let records = await d.findMany();
    if (records.length === 0) return;

    if (d.beforeDelete) {
      await d.beforeDelete(records);
    }

    await d.deleteMany(records);
  }
};

let enqueueStorageDeletes = async (keys: string[]) => {
  if (keys.length === 0) return;

  await shuttleRetentionStorageCleanupQueue.addMany(keys.map(key => ({ key })));
};

let cleanupConnectionLogStorage = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  let cursor: string | undefined = undefined;

  while (true) {
    let records: { id: string }[] = await db.serverConnection.findMany({
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
    if (records.length === 0) return;

    await enqueueStorageDeletes(records.map(record => `logs/${record.id}/data`));

    cursor = records[records.length - 1]?.id;
    if (records.length < RETENTION_BATCH_SIZE) return;
  }
};

let cleanupConnectionLogRows = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{
    oid: bigint;
  }>({
    findMany: () =>
      db.serverConnectionLogsTemp.findMany({
        where: {
          serverConnection: {
            tenantOid: d.tenantOid
          },
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
  });
};

let cleanupFunctionInvocations = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{
    oid: bigint;
  }>({
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
  });
};

let cleanupServerDiscoveries = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{
    oid: bigint;
  }>({
    findMany: () =>
      db.serverDiscovery.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: records =>
      db.serverDiscovery.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      })
  });
};

let cleanupDeploymentSteps = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{
    oid: bigint;
  }>({
    findMany: () =>
      db.serverDeploymentStep.findMany({
        where: {
          deployment: {
            tenantOid: d.tenantOid
          },
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
  });
};

let cleanupServerAuthConfigEvents = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{ oid: bigint }>({
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
  });
};

let cleanupServerOAuthSetupEvents = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{ oid: bigint }>({
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
  });
};

let cleanupDeployments = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{
    oid: bigint;
  }>({
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
  });
};

export let shuttleRetentionCron = createCron(
  {
    name: 'shut/ret/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '0 0 * * *'
  },
  async () => {
    await shuttleTenantRetentionSearchQueue.add({});
  }
);

export let shuttleTenantRetentionSearchQueue = createQueue<{ cursor?: string }>({
  name: 'shut/ret/search',
  redisUrl: env.service.REDIS_URL
});

export let shuttleTenantRetentionSearchQueueProcessor =
  shuttleTenantRetentionSearchQueue.process(async data => {
    let tenants = await db.tenant.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RETENTION_BATCH_SIZE,
      select: { id: true }
    });
    if (tenants.length === 0) return;

    await shuttleTenantRetentionCleanupQueue.addMany(
      tenants.map(tenant => ({
        tenantId: tenant.id
      }))
    );

    await shuttleTenantRetentionSearchQueue.add({
      cursor: tenants[tenants.length - 1]?.id
    });
  });

export let shuttleTenantRetentionCleanupQueue = createQueue<{ tenantId: string }>({
  name: 'shut/ret/tenant',
  redisUrl: env.service.REDIS_URL,
  workerOpts: retentionCleanupWorkerOpts
});

export let shuttleTenantRetentionCleanupQueueProcessor =
  shuttleTenantRetentionCleanupQueue.process(async data => {
    let tenant = await db.tenant.findUnique({
      where: { id: data.tenantId },
      select: {
        oid: true,
        logRetentionInDays: true
      }
    });
    if (!tenant) return;

    let cutoffDate = getRetentionCutoffDate(tenant.logRetentionInDays);

    await cleanupConnectionLogStorage({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupConnectionLogRows({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupFunctionInvocations({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupServerDiscoveries({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupServerAuthConfigEvents({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupServerOAuthSetupEvents({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupDeploymentSteps({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupDeployments({
      tenantOid: tenant.oid,
      cutoffDate
    });
  });

export let shuttleRetentionStorageCleanupQueue = createQueue<StorageCleanupRecord>({
  name: 'shut/ret/storage',
  redisUrl: env.service.REDIS_URL,
  workerOpts: retentionStorageCleanupWorkerOpts
});

export let shuttleRetentionStorageCleanupQueueProcessor =
  shuttleRetentionStorageCleanupQueue.process(async data => {
    await storage.deleteObject(connectionLogsBucketRecord.bucket, data.key);
  });
