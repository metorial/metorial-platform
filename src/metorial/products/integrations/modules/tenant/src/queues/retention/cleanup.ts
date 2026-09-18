import { createObjectDeleteQueue } from '@lowerdeck/queue';
import { createRetentionRunner, retentionPhaseBatch } from '@lowerdeck/retention-runner';
import { sessionMessageBucketRecord, storage } from '@metorial-subspace/connection-utils';
import { db } from '@metorial-subspace/db';
import { getConnectionRetentionWhere } from '@metorial-subspace/list-utils';
import { env } from '../../env';
import {
  getRetentionCutoffDate,
  RETENTION_BATCH_SIZE,
  retentionCleanupWorkerOpts
} from './_config';

let terminalMessageStatuses = ['failed', 'succeeded'] as const;

let enqueueStorageDeletes = async (keys: string[]) => {
  await tenantLogRetentionStorageCleanupQueue.enqueue(sessionMessageBucketRecord.bucket, keys);
};

let cleanupSessionEvents = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  return retentionPhaseBatch<{ oid: bigint }>({
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
  return retentionPhaseBatch<{
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
      await db.toolCall.deleteMany({
        where: { messageOid: { in: records.map(record => record.oid) } }
      });
    },
    deleteMany: async records => {
      await db.sessionMessage.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      });

      await enqueueStorageDeletes(
        records
          .filter(record => record.isOffloadedToStorage)
          .map(record => `msg/${record.id}/data`)
      );
    }
  });
};

let cleanupSessionWarnings = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  return retentionPhaseBatch<{ oid: bigint }>({
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

let cleanupProtoGuardRuns = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  return retentionPhaseBatch<{ oid: bigint }>({
    findMany: () =>
      db.protoGuardRun.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: records =>
      db.protoGuardRun.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      })
  });
};

let cleanupMonitorAlerts = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  return retentionPhaseBatch<{ oid: bigint }>({
    findMany: () =>
      db.monitorAlert.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: records =>
      db.monitorAlert.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      })
  });
};

let cleanupSessionErrors = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  return retentionPhaseBatch<{
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
  return retentionPhaseBatch<{ id: string }>({
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
  return retentionPhaseBatch<{ oid: bigint }>({
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

      let slateSessions = await db.slateSession.findMany({
        where: { providerRunOid: { in: providerRunOids } },
        select: { oid: true }
      });
      let slateSessionOids = slateSessions.map(session => session.oid);

      if (slateSessionOids.length > 0) {
        let slateToolCalls = await db.slateToolCall.findMany({
          where: { sessionOid: { in: slateSessionOids } },
          select: { oid: true }
        });
        let slateToolCallOids = slateToolCalls.map(toolCall => toolCall.oid);

        if (slateToolCallOids.length > 0) {
          await db.sessionMessage.updateMany({
            where: { slateToolCallOid: { in: slateToolCallOids } },
            data: { slateToolCallOid: null }
          });

          await db.slateToolCall.deleteMany({
            where: { oid: { in: slateToolCallOids } }
          });
        }

        await db.slateSession.deleteMany({
          where: { oid: { in: slateSessionOids } }
        });
      }

      await db.shuttleConnection.deleteMany({
        where: { providerRunOid: { in: providerRunOids } }
      });

      await db.providerRunUsageRecord.deleteMany({
        where: { providerRunOid: { in: providerRunOids } }
      });

      await Promise.all([
        db.sessionEvent.updateMany({
          where: { providerRunOid: { in: providerRunOids } },
          data: {
            providerRunOid: null,
            isParentDeleted: true
          }
        }),
        db.sessionMessage.updateMany({
          where: { providerRunOid: { in: providerRunOids } },
          data: {
            providerRunOid: null,
            isParentDeleted: true
          }
        }),
        db.sessionError.updateMany({
          where: { providerRunOid: { in: providerRunOids } },
          data: {
            providerRunOid: null,
            isParentDeleted: true
          }
        }),
        db.toolCall.updateMany({
          where: { providerRunOid: { in: providerRunOids } },
          data: { providerRunOid: null }
        })
      ]);

      await db.providerRun.deleteMany({
        where: { oid: { in: providerRunOids } }
      });
    }
  });
};

let cleanupSessionUsageRecords = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  return retentionPhaseBatch<{ id: string }>({
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
  return retentionPhaseBatch<{ oid: bigint }>({
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

      await Promise.all([
        db.sessionEvent.updateMany({
          where: { connectionOid: { in: connectionOids } },
          data: {
            connectionOid: null,
            isParentDeleted: true
          }
        }),
        db.sessionMessage.updateMany({
          where: { connectionOid: { in: connectionOids } },
          data: {
            connectionOid: null,
            isParentDeleted: true
          }
        }),
        db.sessionError.updateMany({
          where: { connectionOid: { in: connectionOids } },
          data: {
            connectionOid: null,
            isParentDeleted: true
          }
        }),
        db.sessionWarning.updateMany({
          where: { connectionOid: { in: connectionOids } },
          data: {
            connectionOid: null,
            isParentDeleted: true
          }
        }),
        db.protoGuardRun.updateMany({
          where: { connectionOid: { in: connectionOids } },
          data: {
            connectionOid: null
          }
        }),
        db.protoGuardAlert.updateMany({
          where: { connectionOid: { in: connectionOids } },
          data: {
            connectionOid: null
          }
        })
      ]);

      await db.sessionConnection.deleteMany({
        where: { oid: { in: connectionOids } }
      });
    }
  });
};

let cleanupProviderAuthExports = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  return retentionPhaseBatch<{ oid: bigint }>({
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
  return retentionPhaseBatch<{ oid: bigint }>({
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
  return retentionPhaseBatch<{ oid: bigint }>({
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

let cleanupProviderAuthConfigErrors = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  return retentionPhaseBatch<{ oid: bigint }>({
    findMany: () =>
      db.providerAuthConfigError.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate },
          isProcessing: false
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: async records => {
      let errorOids = records.map(record => record.oid);

      await db.providerAuthConfigErrorGlobal.updateMany({
        where: { firstOccurrenceOid: { in: errorOids } },
        data: { firstOccurrenceOid: null }
      });

      await db.providerAuthConfigError.deleteMany({
        where: { oid: { in: errorOids } }
      });
    }
  });
};

let cleanupProviderAuthConfigEvents = async (d: { tenantOid: bigint; cutoffDate: Date }) => {
  return retentionPhaseBatch<{ oid: bigint }>({
    findMany: () =>
      db.providerAuthConfigEvent.findMany({
        where: {
          tenantOid: d.tenantOid,
          createdAt: { lt: d.cutoffDate },
          errors: { none: {} }
        },
        orderBy: { createdAt: 'asc' },
        take: RETENTION_BATCH_SIZE,
        select: { oid: true }
      }),
    deleteMany: records =>
      db.providerAuthConfigEvent.deleteMany({
        where: { oid: { in: records.map(record => record.oid) } }
      })
  });
};

let cleanupProviderDeploymentConfigPairDiscoveries = async (d: {
  tenantOid: bigint;
  cutoffDate: Date;
}) => {
  return retentionPhaseBatch<{ oid: bigint }>({
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

interface TenantLogRetentionTenant {
  tenantOid: bigint;
  cutoffDate: Date;
}

let tenantLogRetentionRunner = createRetentionRunner<TenantLogRetentionTenant>({
  name: 'sub/ten/ret/cleanup',
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

    return {
      tenantOid: tenant.oid,
      cutoffDate: getRetentionCutoffDate(tenant.logRetentionInDays)
    };
  },

  phases: {
    sessionEvents: d => cleanupSessionEvents(d),
    sessionMessages: d => cleanupSessionMessages(d),
    sessionWarnings: d => cleanupSessionWarnings(d),
    protoGuardRuns: d => cleanupProtoGuardRuns(d),
    monitorAlerts: d => cleanupMonitorAlerts(d),
    sessionErrors: d => cleanupSessionErrors(d),
    providerRunUsageRecords: d => cleanupProviderRunUsageRecords(d),
    providerRuns: d => cleanupProviderRuns(d),
    sessionUsageRecords: d => cleanupSessionUsageRecords(d),
    sessionConnections: d => cleanupSessionConnections(d),
    providerAuthExports: d => cleanupProviderAuthExports(d),
    providerAuthImports: d => cleanupProviderAuthImports(d),
    providerAuthConfigErrors: d => cleanupProviderAuthConfigErrors(d),
    providerAuthConfigEvents: d => cleanupProviderAuthConfigEvents(d),
    providerSetupSessionEvents: d => cleanupProviderSetupSessionEvents(d),
    providerDeploymentConfigPairDiscoveries: d => cleanupProviderDeploymentConfigPairDiscoveries(d)
  }
});

export let tenantLogRetentionCleanupCron = tenantLogRetentionRunner.cron;
export let tenantLogRetentionCleanupSearchQueue = tenantLogRetentionRunner.searchQueue;
export let tenantLogRetentionCleanupQueue = tenantLogRetentionRunner.tenantQueue;
export let tenantLogRetentionProcessors = tenantLogRetentionRunner.processors;

export let tenantLogRetentionStorageCleanupQueue = createObjectDeleteQueue({
  name: 'sub/ten/ret/storage/object',
  redisUrl: env.service.REDIS_URL,
  deleteObject: (bucket, key) => storage.deleteObject(bucket, key)
});

export let tenantLogRetentionStorageCleanupQueueProcessor = tenantLogRetentionStorageCleanupQueue.processor;
