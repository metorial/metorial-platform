import { createObjectDeleteQueue } from '@lowerdeck/queue';
import { createRetentionRunner, retentionPhaseBatch } from '@lowerdeck/retention-runner';
import { SlateDeploymentStatus } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { invocationsBucketRecord, storage } from '../../storage';
import {
  getRetentionCutoffDate,
  RETENTION_BATCH_SIZE,
  retentionCleanupWorkerOpts,
  TRIGGER_AND_WEBHOOK_RETENTION_DAYS
} from './_config';

let enqueueStorageDeletes = async (keys: string[]) => {
  await slatesRetentionStorageCleanupQueue.enqueue(invocationsBucketRecord.bucket, keys);
};

interface SlatesRetentionTenant {
  tenantOid: bigint;
  cutoffDate: Date;
  triggerAndWebhookCutoffDate: Date;
}

let slatesRetentionRunner = createRetentionRunner<SlatesRetentionTenant>({
  name: 'shub/ret',
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
      cutoffDate: getRetentionCutoffDate(tenant.logRetentionInDays),
      triggerAndWebhookCutoffDate: getRetentionCutoffDate(TRIGGER_AND_WEBHOOK_RETENTION_DAYS)
    };
  },

  phases: {
    instanceEvents: d =>
      retentionPhaseBatch({
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
      }),

    authConfigEvents: d =>
      retentionPhaseBatch({
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
      }),

    oauthSetupEvents: d =>
      retentionPhaseBatch({
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
      }),

    versionDiscoveries: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.slateVersionDiscovery.findMany({
            where: {
              slateVersion: { slate: { registry: { tenantOid: d.tenantOid } } },
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
      }),

    slateEvents: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.slateEvent.findMany({
            where: {
              slate: { registry: { tenantOid: d.tenantOid } },
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
      }),

    specificationChanges: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.slateSpecificationChange.findMany({
            where: {
              slate: { registry: { tenantOid: d.tenantOid } },
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
      }),

    sessions: d =>
      retentionPhaseBatch({
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
      }),

    invocations: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.slateInvocation.findMany({
            where: {
              deployment: { slate: { registry: { tenantOid: d.tenantOid } } },
              createdAt: { lt: d.cutoffDate }
            },
            orderBy: { createdAt: 'asc' },
            take: RETENTION_BATCH_SIZE,
            select: { oid: true, id: true }
          }),
        beforeDelete: async records => {
          await db.slateInvocationAttachment.deleteMany({
            where: { invocationOid: { in: records.map(record => record.oid) } }
          });
        },
        deleteMany: async records => {
          await db.slateInvocation.deleteMany({
            where: { id: { in: records.map(record => record.id) } }
          });

          await enqueueStorageDeletes(
            records.map(record => `invocations/${record.id}/logs`)
          );
        }
      }),

    deployments: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.slateDeployment.findMany({
            where: {
              slate: { registry: { tenantOid: d.tenantOid } },
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
      }),

    triggerEvents: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.triggerEvent.findMany({
            where: {
              triggerRegistrationInstance: {
                triggerRegistration: { tenantOid: d.tenantOid }
              },
              status: { in: ['mapped', 'mapping_failed_final'] },
              createdAt: { lt: d.triggerAndWebhookCutoffDate }
            },
            orderBy: { createdAt: 'asc' },
            take: RETENTION_BATCH_SIZE,
            select: { id: true, payloadStorageKey: true }
          }),
        // TriggerEventInvocation rows cascade-delete along with their TriggerEvent.
        deleteMany: async records => {
          await db.triggerEvent.deleteMany({
            where: { id: { in: records.map(record => record.id) } }
          });

          await enqueueStorageDeletes(
            records.flatMap(record =>
              record.payloadStorageKey ? [record.payloadStorageKey] : []
            )
          );
        }
      }),

    triggerRawEvents: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.triggerRawEvent.findMany({
            where: {
              triggerRegistrationInstance: {
                triggerRegistration: { tenantOid: d.tenantOid }
              },
              createdAt: { lt: d.cutoffDate }
            },
            orderBy: { createdAt: 'asc' },
            take: RETENTION_BATCH_SIZE,
            select: { id: true, payloadStorageKey: true }
          }),
        deleteMany: async records => {
          await db.triggerRawEvent.deleteMany({
            where: { id: { in: records.map(record => record.id) } }
          });

          await enqueueStorageDeletes(
            records.flatMap(record =>
              record.payloadStorageKey ? [record.payloadStorageKey] : []
            )
          );
        }
      }),

    slateWebhookEvents: d =>
      retentionPhaseBatch({
        findMany: () =>
          db.slateWebhookEvent.findMany({
            where: {
              webhookRegistration: { owner: 'tenant', tenantOid: d.tenantOid },
              status: { in: ['succeeded', 'failed_final'] },
              createdAt: { lt: d.triggerAndWebhookCutoffDate },
              triggerRawEvents: { none: {} },
              triggerEvents: { none: {} }
            },
            orderBy: { createdAt: 'asc' },
            take: RETENTION_BATCH_SIZE,
            select: { id: true, requestStorageKey: true }
          }),
        // SlateWebhookEventInvocation rows cascade-delete along with their SlateWebhookEvent.
        deleteMany: async records => {
          await db.slateWebhookEvent.deleteMany({
            where: { id: { in: records.map(record => record.id) } }
          });

          await enqueueStorageDeletes(
            records.flatMap(record =>
              record.requestStorageKey ? [record.requestStorageKey] : []
            )
          );
        }
      })
  }
});

export let slatesRetentionCron = slatesRetentionRunner.cron;
export let slatesTenantRetentionSearchQueue = slatesRetentionRunner.searchQueue;
export let slatesTenantRetentionCleanupQueue = slatesRetentionRunner.tenantQueue;
export let slatesRetentionProcessors = slatesRetentionRunner.processors;

export let slatesRetentionStorageCleanupQueue = createObjectDeleteQueue({
  name: 'shub/ret/storage/object',
  redisUrl: env.service.REDIS_URL,
  deleteObject: (bucket, key) => storage.deleteObject(bucket, key)
});

export let slatesRetentionStorageCleanupQueueProcessor =
  slatesRetentionStorageCleanupQueue.processor;
