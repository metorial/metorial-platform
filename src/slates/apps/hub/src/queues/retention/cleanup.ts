import { createCron } from '@lowerdeck/cron';
import { createQueue } from '@lowerdeck/queue';
import { SlateDeploymentStatus } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { invocationsBucketRecord, storage } from '../../storage';
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

  await slatesRetentionStorageCleanupQueue.addMany(keys.map(key => ({ key })));
};

let cleanupTenantInstanceEvents = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch({
    findMany: () =>
      db.slateInstanceEvent.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { id: true }
      }),
    deleteMany: records =>
      db.slateInstanceEvent.deleteMany({
        where: { id: { in: records.map(record => record.id) } }
      })
  });
};

let cleanupTenantAuthConfigEvents = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch({
    findMany: () =>
      db.slateAuthConfigEvent.findMany({
        where: {
          config: { tenantOid: d.tenantOid },
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: records =>
      db.slateAuthConfigEvent.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      })
  });
};

let cleanupTenantOAuthSetupEvents = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch({
    findMany: () =>
      db.slateInstanceOAuthSetupEvent.findMany({
        where: {
          setup: { tenantOid: d.tenantOid },
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: records =>
      db.slateInstanceOAuthSetupEvent.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      })
  });
};

let cleanupTenantVersionDiscoveries = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch({
    findMany: () =>
      db.slateVersionDiscovery.findMany({
        where: {
          slateVersion: {
            slate: {
              registry: {
                tenantOid: d.tenantOid
              }
            }
          },
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { id: true }
      }),
    deleteMany: records =>
      db.slateVersionDiscovery.deleteMany({
        where: { id: { in: records.map(record => record.id) } }
      })
  });
};

let cleanupTenantSlateEvents = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch({
    findMany: () =>
      db.slateEvent.findMany({
        where: {
          slate: {
            registry: {
              tenantOid: d.tenantOid
            }
          },
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { id: true }
      }),
    deleteMany: records =>
      db.slateEvent.deleteMany({
        where: { id: { in: records.map(record => record.id) } }
      })
  });
};

let cleanupTenantSpecificationChanges = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch({
    findMany: () =>
      db.slateSpecificationChange.findMany({
        where: {
          slate: {
            registry: {
              tenantOid: d.tenantOid
            }
          },
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { id: true }
      }),
    deleteMany: records =>
      db.slateSpecificationChange.deleteMany({
        where: { id: { in: records.map(record => record.id) } }
      })
  });
};

let cleanupTenantSessions = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch({
    findMany: () =>
      db.slateSession.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate },
          OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: d.cutoffDate } }]
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { id: true }
      }),
    deleteMany: records =>
      db.slateSession.deleteMany({
        where: { id: { in: records.map(record => record.id) } }
      })
  });
};

let cleanupTenantInvocations = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch({
    findMany: () =>
      db.slateInvocation.findMany({
        where: {
          deployment: {
            slate: {
              registry: {
                tenantOid: d.tenantOid
              }
            }
          },
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true, id: true }
      }),
    beforeDelete: async records => {
      await db.slateInvocationAttachment.deleteMany({
        where: {
          invocationOid: { in: records.map(record => record.oid) }
        }
      });

      await enqueueStorageDeletes(records.map(record => `invocations/${record.id}/logs`));
    },
    deleteMany: records =>
      db.slateInvocation.deleteMany({
        where: { id: { in: records.map(record => record.id) } }
      })
  });
};

let cleanupTenantDeployments = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch({
    findMany: () =>
      db.slateDeployment.findMany({
        where: {
          slate: {
            registry: {
              tenantOid: d.tenantOid
            }
          },
          status: {
            in: [SlateDeploymentStatus.succeeded, SlateDeploymentStatus.failed]
          },
          createdAt: { lt: d.cutoffDate },
          slateInvocations: { none: {} },
          slateVersions: { none: {} }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { id: true }
      }),
    deleteMany: records =>
      db.slateDeployment.deleteMany({
        where: { id: { in: records.map(record => record.id) } }
      })
  });
};

export let slatesRetentionCron = createCron(
  {
    name: 'shub/ret/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '0 0 * * *'
  },
  async () => {
    await slatesTenantRetentionSearchQueue.add({});
  }
);

export let slatesTenantRetentionSearchQueue = createQueue<{ cursor?: string }>({
  name: 'shub/ret/search',
  redisUrl: env.service.REDIS_URL
});

export let slatesTenantRetentionSearchQueueProcessor =
  slatesTenantRetentionSearchQueue.process(async data => {
    let tenants = await db.tenant.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RETENTION_BATCH_SIZE,
      select: { id: true }
    });
    if (tenants.length === 0) return;

    await slatesTenantRetentionCleanupQueue.addMany(
      tenants.map(tenant => ({
        tenantId: tenant.id
      }))
    );

    await slatesTenantRetentionSearchQueue.add({
      cursor: tenants[tenants.length - 1]?.id
    });
  });

export let slatesTenantRetentionCleanupQueue = createQueue<{ tenantId: string }>({
  name: 'shub/ret/tenant',
  redisUrl: env.service.REDIS_URL,
  workerOpts: retentionCleanupWorkerOpts
});

export let slatesTenantRetentionCleanupQueueProcessor =
  slatesTenantRetentionCleanupQueue.process(async data => {
    let tenant = await db.tenant.findUnique({
      where: { id: data.tenantId },
      select: {
        oid: true,
        logRetentionInDays: true
      }
    });
    if (!tenant) return;

    let cutoffDate = getRetentionCutoffDate(tenant.logRetentionInDays);

    await cleanupTenantInstanceEvents({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupTenantAuthConfigEvents({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupTenantOAuthSetupEvents({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupTenantVersionDiscoveries({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupTenantSlateEvents({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupTenantSpecificationChanges({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupTenantSessions({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupTenantInvocations({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupTenantDeployments({
      tenantOid: tenant.oid,
      cutoffDate
    });
  });

export let slatesRetentionStorageCleanupQueue = createQueue<StorageCleanupRecord>({
  name: 'shub/ret/storage',
  redisUrl: env.service.REDIS_URL,
  workerOpts: retentionStorageCleanupWorkerOpts
});

export let slatesRetentionStorageCleanupQueueProcessor =
  slatesRetentionStorageCleanupQueue.process(async data => {
    await storage.deleteObject(invocationsBucketRecord.bucket, data.key);
  });
