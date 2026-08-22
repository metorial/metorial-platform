import { isServiceError } from '@lowerdeck/error';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import {
  db,
  getId,
  withTransaction,
  type Callback,
  type CallbackInstance,
  type Environment,
  type Tenant
} from '@metorial-subspace/db';
import { resolveCallbackProviderTriggers } from '../lib/resolveCallbackProviderTriggers';
import { callbackRegistrationService } from '../services/callbackRegistration';
import { callbackConfigService } from '../services/callbackConfig';
import { callbackInstanceService } from '../services/callbackInstance';
import { callbackService } from '../services/callback';
import { env } from '../env';
import { callbackConfigBackingDeleteQueue } from './deleteCallbackConfigBacking';

let PAGE_SIZE = 250;

export type CallbackIntegrationReconcileInput =
  | {
      integrationInstanceProviderId: string;
      targetVersionId?: string;
      archived?: boolean;
    }
  | {
      integrationInstanceId: string;
    };

export let callbackIntegrationReconcileQueue = createQueue<CallbackIntegrationReconcileInput>({
  name: 'sub/callback/integration/reconcile',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 10 }
});

export let callbackFanoutQueue = createQueue<{ callbackId: string }>({
  name: 'sub/callback/integration/fanout',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 2 }
});

export let callbackProviderReconcileQueue = createQueue<{
  integrationProviderId: string;
  archived?: boolean;
}>({
  name: 'sub/callback/integration/provider-reconcile',
  redisUrl: env.service.REDIS_URL,
  workerOpts: { concurrency: 2 }
});

let enqueueIntegrationInstanceProviders = async (ids: string[]) => {
  if (!ids.length) return;
  await callbackIntegrationReconcileQueue.addMany(
    ids.map(integrationInstanceProviderId => ({ integrationInstanceProviderId }))
  );
};

let detachIfAttached = async (d: {
  tenant: Tenant;
  environment: Environment;
  callbackInstance: CallbackInstance | null;
}) => {
  if (!d.callbackInstance || d.callbackInstance.status !== 'attached') return;
  await callbackInstanceService.detachInternal({
    tenant: d.tenant,
    environment: d.environment,
    callbackInstance: d.callbackInstance
  });
};

export let callbackIntegrationReconcileQueueProcessor =
  callbackIntegrationReconcileQueue.process(async data => {
    if ('integrationInstanceId' in data) {
      let cursor: string | undefined;
      while (true) {
        let providers = await db.integrationInstanceProvider.findMany({
          where: {
            integrationInstance: { id: data.integrationInstanceId },
            id: cursor ? { gt: cursor } : undefined
          },
          orderBy: { id: 'asc' },
          take: PAGE_SIZE,
          select: { id: true }
        });
        if (!providers.length) return;
        await enqueueIntegrationInstanceProviders(providers.map(provider => provider.id));
        if (providers.length < PAGE_SIZE) return;
        cursor = providers[providers.length - 1]!.id;
      }
    }

    let integrationInstanceProvider = await db.integrationInstanceProvider.findUnique({
      where: { id: data.integrationInstanceProviderId },
      include: {
        tenant: true,
        environment: true,
        integrationInstance: true,
        currentVersion: {
          include: {
            config: true,
            authConfig: true
          }
        },
        integrationProvider: {
          include: {
            currentVersion: {
              include: {
                config: true,
                deployment: true
              }
            }
          }
        }
      }
    });
    if (!integrationInstanceProvider) throw new QueueRetryError();

    let callback = await db.callback.findUnique({
      where: {
        integrationProviderOid: integrationInstanceProvider.integrationProviderOid
      },
      include: {
        providerDeployment: {
          include: {
            provider: { include: { type: true } },
            currentVersion: true
          }
        }
      }
    });
    let callbackInstance = await db.callbackInstance.findFirst({
      where: {
        integrationInstanceProviderOid: integrationInstanceProvider.oid
      }
    });
    let currentVersion = integrationInstanceProvider.currentVersion;
    let integrationProviderVersion =
      integrationInstanceProvider.integrationProvider.currentVersion;
    let valid =
      !data.archived &&
      callback?.status === 'active' &&
      integrationInstanceProvider.status === 'active' &&
      !integrationInstanceProvider.isParentDeleted &&
      integrationInstanceProvider.currentVersionOid !== null &&
      currentVersion?.status === 'active' &&
      integrationInstanceProvider.integrationProvider.status === 'active' &&
      integrationProviderVersion?.status === 'active' &&
      (integrationInstanceProvider.integrationInstance.status === 'active' ||
        integrationInstanceProvider.integrationInstance.status === 'draft') &&
      !integrationInstanceProvider.integrationInstance.isParentDeleted;

    if (!valid || !callback || !currentVersion || !integrationProviderVersion) {
      try {
        await detachIfAttached({
          tenant: integrationInstanceProvider.tenant,
          environment: integrationInstanceProvider.environment,
          callbackInstance
        });
      } catch {
        throw new QueueRetryError();
      }
      return;
    }

    if (callback.providerDeploymentOid !== integrationProviderVersion.deploymentOid) {
      await callbackProviderReconcileQueue.add({
        integrationProviderId: integrationInstanceProvider.integrationProvider.id
      });
      throw new QueueRetryError();
    }

    let config = currentVersion.config ?? integrationProviderVersion.config;
    if (!config) {
      console.warn(
        `Skipping callback instance reconciliation for ${integrationInstanceProvider.id}: no effective provider config`
      );
      return;
    }

    try {
      await callbackInstanceService.attachInternal({
        tenant: integrationInstanceProvider.tenant,
        environment: integrationInstanceProvider.environment,
        callback,
        config,
        authConfig: currentVersion.authConfig ?? undefined,
        integrationInstance: integrationInstanceProvider.integrationInstance,
        integrationInstanceProvider
      });
    } catch (error) {
      if (
        isServiceError(error) &&
        error.data.code === 'callback_instance_integration_mismatch'
      ) {
        throw error;
      }
      throw new QueueRetryError();
    }
  });

export let callbackFanoutQueueProcessor = callbackFanoutQueue.process(async data => {
  let callback = await db.callback.findUnique({
    where: { id: data.callbackId },
    select: { oid: true, integrationProviderOid: true }
  });
  if (!callback) return;

  let providerCursor: string | undefined;
  while (true) {
    let providers = await db.integrationInstanceProvider.findMany({
      where: {
        integrationProviderOid: callback.integrationProviderOid,
        status: 'active',
        isParentDeleted: false,
        currentVersionOid: { not: null },
        id: providerCursor ? { gt: providerCursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      select: { id: true }
    });
    if (!providers.length) break;
    await enqueueIntegrationInstanceProviders(providers.map(provider => provider.id));
    if (providers.length < PAGE_SIZE) break;
    providerCursor = providers[providers.length - 1]!.id;
  }

  let instanceCursor: string | undefined;
  while (true) {
    let callbackInstances = await db.callbackInstance.findMany({
      where: {
        callbackOid: callback.oid,
        id: instanceCursor ? { gt: instanceCursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: PAGE_SIZE,
      select: {
        id: true,
        integrationInstanceProvider: { select: { id: true } }
      }
    });
    if (!callbackInstances.length) return;
    await enqueueIntegrationInstanceProviders(
      callbackInstances.map(row => row.integrationInstanceProvider.id)
    );
    if (callbackInstances.length < PAGE_SIZE) return;
    instanceCursor = callbackInstances[callbackInstances.length - 1]!.id;
  }
});

let archiveCallbackProjection = async (d: {
  callback: Callback;
  tenant: Tenant;
  environment: Environment;
}) => {
  if (d.callback.status === 'active') {
    await callbackService.archiveCallbackInternal(d);
  } else {
    await callbackRegistrationService.syncCallback({ callbackId: d.callback.id });
  }
  await callbackFanoutQueue.add({ callbackId: d.callback.id });
};

let shouldArchiveProjectionError = (error: unknown) =>
  isServiceError(error) &&
  [
    'invalid_callback_trigger',
    'invalid_trigger_action',
    'callback_config_incomplete'
  ].includes(error.data.code);

export let callbackProviderReconcileQueueProcessor = callbackProviderReconcileQueue.process(
  async data => {
    let integrationProvider = await db.integrationProvider.findUnique({
      where: { id: data.integrationProviderId },
      include: {
        tenant: true,
        environment: true,
        integration: true,
        currentVersion: {
          include: {
            config: true,
            deployment: true
          }
        },
        callback: {
          include: {
            callbackProviderTriggers: { include: { providerTrigger: true } },
            callbackConfig: { include: { currentVersion: true } }
          }
        }
      }
    });
    if (!integrationProvider) throw new QueueRetryError();
    let callback = integrationProvider.callback;
    if (!callback) return;

    let currentVersion = integrationProvider.currentVersion;
    if (
      data.archived ||
      integrationProvider.status !== 'active' ||
      currentVersion?.status !== 'active'
    ) {
      await archiveCallbackProjection({
        callback,
        tenant: integrationProvider.tenant,
        environment: integrationProvider.environment
      });
      return;
    }
    if (!currentVersion) throw new QueueRetryError();
    if (callback.status !== 'active') {
      await callbackFanoutQueue.add({ callbackId: callback.id });
      return;
    }

    if (
      callback.integrationOid === integrationProvider.integrationOid &&
      callback.providerDeploymentOid === currentVersion.deploymentOid
    ) {
      try {
        await callbackRegistrationService.syncCallback({ callbackId: callback.id });
      } catch {
        throw new QueueRetryError();
      }
      await callbackFanoutQueue.add({ callbackId: callback.id });
      return;
    }

    let resolvedTriggers;
    let configSchema;
    try {
      resolvedTriggers = await resolveCallbackProviderTriggers({
        environment: integrationProvider.environment,
        deployment: currentVersion.deployment,
        inputTriggers: callback.callbackProviderTriggers.map(trigger => ({
          triggerId: trigger.providerTrigger.specUniqueIdentifier,
          eventTypes: trigger.eventTypes
        }))
      });
      configSchema = await callbackConfigService.getCallbackConfigSchemaInternal({
        tenant: integrationProvider.tenant,
        integrationProvider,
        providerTriggers: resolvedTriggers.map(trigger => trigger.providerTrigger)
      });
    } catch (error) {
      if (!shouldArchiveProjectionError(error)) throw new QueueRetryError();
      await archiveCallbackProjection({
        callback,
        tenant: integrationProvider.tenant,
        environment: integrationProvider.environment
      });
      return;
    }

    if (
      configSchema.schema &&
      (callback.callbackConfig?.status !== 'active' || !callback.callbackConfig.currentVersion)
    ) {
      await archiveCallbackProjection({
        callback,
        tenant: integrationProvider.tenant,
        environment: integrationProvider.environment
      });
      return;
    }

    let result;
    try {
      result = await withTransaction(async tx => {
        let updated = await tx.callback.update({
          where: { oid: callback.oid },
          data: {
            integrationOid: integrationProvider.integrationOid,
            providerDeploymentOid: currentVersion.deploymentOid
          }
        });
        let configResult = configSchema.schema
          ? await callbackConfigService.setCallbackConfigInternal({
              tenant: integrationProvider.tenant,
              callback: updated,
              providerTriggers: resolvedTriggers.map(trigger => trigger.providerTrigger),
              valuesPatch: {},
              db: tx
            })
          : await callbackConfigService.clearCallbackConfigInternal({
              tenant: integrationProvider.tenant,
              callback: updated,
              db: tx
            });

        await tx.callbackProviderTrigger.deleteMany({
          where: { callbackOid: callback.oid }
        });
        await tx.callbackProviderTrigger.createMany({
          data: resolvedTriggers.map(trigger => ({
            ...getId('callbackProviderTrigger'),
            callbackOid: callback.oid,
            providerTriggerOid: trigger.providerTrigger.oid,
            eventTypes: trigger.eventTypes
          }))
        });

        return {
          callbackId: callback.id,
          supersededCallbackConfigVersionId: configResult.supersededCallbackConfigVersionId
        };
      });
    } catch (error) {
      if (!shouldArchiveProjectionError(error)) throw new QueueRetryError();
      await archiveCallbackProjection({
        callback,
        tenant: integrationProvider.tenant,
        environment: integrationProvider.environment
      });
      return;
    }

    try {
      await callbackRegistrationService.syncCallback({ callbackId: result.callbackId });
    } catch {
      throw new QueueRetryError();
    }
    if (result.supersededCallbackConfigVersionId) {
      await callbackConfigBackingDeleteQueue.add({
        callbackConfigVersionId: result.supersededCallbackConfigVersionId
      });
    }
    await callbackFanoutQueue.add({ callbackId: result.callbackId });
  }
);
