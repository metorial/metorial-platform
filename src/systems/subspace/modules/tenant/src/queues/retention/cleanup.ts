import { createCron } from '@mtsrc/cron';
import { createQueue } from '@mtsrc/queue';
import { sessionMessageBucketRecord, storage } from '@metorial-subspace/connection-utils';
import { db, withTransaction } from '@metorial-subspace/db';
import { env } from '../../env';
import { getConnectionRetentionWhere } from '@metorial-subspace/list-utils';
import {
  getRetentionCutoffDate,
  RETENTION_BATCH_SIZE,
  retentionCleanupWorkerOpts,
  retentionStorageCleanupWorkerOpts
} from './_config';

type StorageCleanupRecord = {
  key: string;
};

let terminalMessageStatuses = ['failed', 'succeeded'] as const;

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

  await tenantLogRetentionStorageCleanupQueue.addMany(keys.map(key => ({ key })));
};

let cleanupSessionEvents = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{ oid: bigint }>({
    findMany: () =>
      db.sessionEvent.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: records =>
      db.sessionEvent.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      })
  });
};

let cleanupSessionMessages = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{
    id: string;
    oid: bigint;
    isOffloadedToStorage: boolean;
  }>({
    findMany: () =>
      db.sessionMessage.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate },
          status: { in: [...terminalMessageStatuses] },
          childMessages: { none: {} }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: {
          id: true,
          oid: true,
          isOffloadedToStorage: true
        }
      }),
    beforeDelete: async records => {
      await enqueueStorageDeletes(
        records
          .filter(record => record.isOffloadedToStorage)
          .map(record => `msg/${record.id}/data`)
      );

      await db.toolCall.deleteMany({
        where: { messageOid: { in: records.map(record => record.oid) } }
      });
    },
    deleteMany: records =>
      db.sessionMessage.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      })
  });
};

let cleanupSessionWarnings = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{ oid: bigint }>({
    findMany: () =>
      db.sessionWarning.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: records =>
      db.sessionWarning.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      })
  });
};

let cleanupSessionErrors = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{
    oid: bigint;
    groupOid: bigint | null;
  }>({
    findMany: () =>
      db.sessionError.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate },
          isProcessing: false
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: {
          oid: true,
          groupOid: true
        }
      }),
    deleteMany: async records => {
      await db.sessionError.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      });
    }
  });
};

let cleanupProviderRunUsageRecords = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{ id: string }>({
    findMany: () =>
      db.providerRunUsageRecord.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { id: true }
      }),
    deleteMany: records =>
      db.providerRunUsageRecord.deleteMany({
        where: { id: { in: records.map(record => record.id) } }
      })
  });
};

let cleanupProviderRuns = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{ oid: bigint }>({
    findMany: () =>
      db.providerRun.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate },
          status: 'stopped'
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: async records => {
      let providerRunOids = records.map(record => record.oid);

      await withTransaction(async tx => {
        let slateSessions = await tx.slateSession.findMany({
          where: { providerRunOid: { in: providerRunOids } },
          select: { oid: true }
        });
        let slateSessionOids = slateSessions.map(session => session.oid);

        if (slateSessionOids.length > 0) {
          let slateToolCalls = await tx.slateToolCall.findMany({
            where: { sessionOid: { in: slateSessionOids } },
            select: { oid: true }
          });
          let slateToolCallOids = slateToolCalls.map(toolCall => toolCall.oid);

          if (slateToolCallOids.length > 0) {
            await tx.sessionMessage.updateMany({
              where: { slateToolCallOid: { in: slateToolCallOids } },
              data: { slateToolCallOid: null }
            });

            await tx.slateToolCall.deleteMany({
              where: { oid: { in: slateToolCallOids } }
            });
          }

          await tx.slateSession.deleteMany({
            where: { oid: { in: slateSessionOids } }
          });
        }

        await tx.shuttleConnection.deleteMany({
          where: { providerRunOid: { in: providerRunOids } }
        });

        await tx.providerRunUsageRecord.deleteMany({
          where: { providerRunOid: { in: providerRunOids } }
        });

        await Promise.all([
          tx.sessionEvent.updateMany({
            where: { providerRunOid: { in: providerRunOids } },
            data: {
              providerRunOid: null,
              isParentDeleted: true
            }
          }),
          tx.sessionMessage.updateMany({
            where: { providerRunOid: { in: providerRunOids } },
            data: {
              providerRunOid: null,
              isParentDeleted: true
            }
          }),
          tx.sessionError.updateMany({
            where: { providerRunOid: { in: providerRunOids } },
            data: {
              providerRunOid: null,
              isParentDeleted: true
            }
          }),
          tx.toolCall.updateMany({
            where: { providerRunOid: { in: providerRunOids } },
            data: { providerRunOid: null }
          })
        ]);

        await tx.providerRun.deleteMany({
          where: { oid: { in: providerRunOids } }
        });
      });
    }
  });
};

let cleanupSessionUsageRecords = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{ id: string }>({
    findMany: () =>
      db.sessionUsageRecord.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { id: true }
      }),
    deleteMany: records =>
      db.sessionUsageRecord.deleteMany({
        where: { id: { in: records.map(record => record.id) } }
      })
  });
};

let cleanupSessionConnections = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{ oid: bigint }>({
    findMany: () =>
      db.sessionConnection.findMany({
        where: {
          tenantOid: d.tenantOid,
          providerRuns: { none: {} },
          ...getConnectionRetentionWhere({
            cutoff: d.cutoffDate,
            beforeCutoff: true
          })
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: async records => {
      let connectionOids = records.map(record => record.oid);

      await withTransaction(async tx => {
        await Promise.all([
          tx.sessionEvent.updateMany({
            where: { connectionOid: { in: connectionOids } },
            data: {
              connectionOid: null,
              isParentDeleted: true
            }
          }),
          tx.sessionMessage.updateMany({
            where: { connectionOid: { in: connectionOids } },
            data: {
              connectionOid: null,
              isParentDeleted: true
            }
          }),
          tx.sessionError.updateMany({
            where: { connectionOid: { in: connectionOids } },
            data: {
              connectionOid: null,
              isParentDeleted: true
            }
          }),
          tx.sessionWarning.updateMany({
            where: { connectionOid: { in: connectionOids } },
            data: {
              connectionOid: null,
              isParentDeleted: true
            }
          })
        ]);

        await tx.sessionConnection.deleteMany({
          where: { oid: { in: connectionOids } }
        });
      });
    }
  });
};

let cleanupProviderAuthExports = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{ oid: bigint }>({
    findMany: () =>
      db.providerAuthExport.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: records =>
      db.providerAuthExport.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      })
  });
};

let cleanupProviderAuthImports = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{ oid: bigint }>({
    findMany: () =>
      db.providerAuthImport.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: records =>
      db.providerAuthImport.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      })
  });
};

let cleanupProviderSetupSessionEvents = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  await processBatch<{ oid: bigint }>({
    findMany: () =>
      db.providerSetupSessionEvent.findMany({
        where: {
          session: {
            tenantOid: d.tenantOid
          },
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: records =>
      db.providerSetupSessionEvent.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      })
  });
};

let cleanupProviderDeploymentConfigPairDiscoveries = async (d: {
  tenantOid: bigint;
  cutoffDate: Date;
}) => {
  await processBatch<{ oid: bigint }>({
    findMany: () =>
      db.providerDeploymentConfigPairDiscovery.findMany({
        where: {
          pair: {
            tenantOid: d.tenantOid
          },
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: records =>
      db.providerDeploymentConfigPairDiscovery.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      })
  });
};

export let tenantLogRetentionCleanupCron = createCron(
  {
    name: 'sub/ten/ret/cleanup/cron',
    redisUrl: env.service.REDIS_URL,
    cron: '0 0 * * *'
  },
  async () => {
    await tenantLogRetentionCleanupSearchQueue.add(
      {},
      { id: 'tenant-retention-cleanup-search' }
    );
  }
);

export let tenantLogRetentionCleanupSearchQueue = createQueue<{ cursor?: string }>({
  name: 'sub/ten/ret/cleanup/search',
  redisUrl: env.service.REDIS_URL
});

export let tenantLogRetentionCleanupSearchQueueProcessor =
  tenantLogRetentionCleanupSearchQueue.process(async data => {
    let tenants = await db.tenant.findMany({
      where: {
        id: data.cursor ? { gt: data.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: RETENTION_BATCH_SIZE,
      select: { id: true }
    });
    if (tenants.length === 0) return;

    await tenantLogRetentionCleanupQueue.addMany(
      tenants.map(tenant => ({
        tenantId: tenant.id
      }))
    );

    await tenantLogRetentionCleanupSearchQueue.add({
      cursor: tenants[tenants.length - 1]?.id
    });
  });

export let tenantLogRetentionCleanupQueue = createQueue<{ tenantId: string }>({
  name: 'sub/ten/ret/cleanup/tenant',
  redisUrl: env.service.REDIS_URL,
  workerOpts: retentionCleanupWorkerOpts
});

export let tenantLogRetentionCleanupQueueProcessor = tenantLogRetentionCleanupQueue.process(
  async data => {
    let tenant = await db.tenant.findUnique({
      where: { id: data.tenantId },
      select: {
        oid: true,
        logRetentionInDays: true
      }
    });
    if (!tenant) return;

    let cutoffDate = getRetentionCutoffDate(tenant.logRetentionInDays);

    await cleanupSessionEvents({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupSessionMessages({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupSessionWarnings({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupSessionErrors({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupProviderRunUsageRecords({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupProviderRuns({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupSessionUsageRecords({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupSessionConnections({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupProviderAuthExports({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupProviderAuthImports({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupProviderSetupSessionEvents({
      tenantOid: tenant.oid,
      cutoffDate
    });
    await cleanupProviderDeploymentConfigPairDiscoveries({
      tenantOid: tenant.oid,
      cutoffDate
    });
  }
);

export let tenantLogRetentionStorageCleanupQueue = createQueue<StorageCleanupRecord>({
  name: 'sub/ten/ret/cleanup/storage',
  redisUrl: env.service.REDIS_URL,
  workerOpts: retentionStorageCleanupWorkerOpts
});

export let tenantLogRetentionStorageCleanupQueueProcessor =
  tenantLogRetentionStorageCleanupQueue.process(async data => {
    await storage.deleteObject(sessionMessageBucketRecord.bucket, data.key);
  });
