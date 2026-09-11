import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import {
  type Callback,
  type CallbackInstance,
  db,
  getId,
  type IntegrationInstanceProvider,
  type ProviderVariant,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import type { IProviderCallbacks } from '@metorial-subspace/provider-utils';
import { env } from '../env';
import {
  callbackInclude,
  type CallbackWithRelations,
  type ReconcileIntegrationInstanceProvider,
  reconcileIntegrationInstanceProviderInclude,
  type ReconcileIntegrationProvider,
  reconcileIntegrationProviderInclude
} from '../lib/callbackIncludes';
import { selectCallbackInstanceGenerations } from '../lib/callbackInstanceGeneration';
import { toSyncError } from '../lib/syncError';
import { enqueueCallbackPush } from '../queues/push/callback';
import { enqueueCallbackInstancePush } from '../queues/push/callbackInstance';
import {
  callbackReconcileForIntegrationManyQueue,
  callbackReconcileQueue
} from '../queues/reconcile/callback';
import {
  callbackInstanceReconcileForIntegrationInstanceManyQueue,
  callbackInstanceReconcileManyQueue,
  callbackInstanceReconcileQueue
} from '../queues/reconcile/callbackInstance';

type SyncError = { code: string; message: string };

let getCallbacksBackend = async (
  providerVariant: ProviderVariant
): Promise<IProviderCallbacks | null> => {
  let backend = await getBackend({ entity: providerVariant });
  return backend.callbacks ?? null;
};

let callbackLock = createLock({
  name: 'sub/cb/reconcile/callback/lock',
  redisUrl: env.service.REDIS_URL
});

let callbackInstanceLock = createLock({
  name: 'sub/cb/reconcile/callbackInstance/lock',
  redisUrl: env.service.REDIS_URL
});

class callbackInternalServiceImpl {
  async reconcileCallbacksForIntegration(d: { integrationId: string; cursor?: string }) {
    let integration = await db.integration.findUnique({
      where: { id: d.integrationId },
      select: { oid: true }
    });
    if (!integration) return;

    let integrationProviders = await db.integrationProvider.findMany({
      where: {
        integrationOid: integration.oid,
        id: d.cursor ? { gt: d.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (!integrationProviders.length) return;

    await callbackReconcileQueue.addMany(
      integrationProviders.map(integrationProvider => ({
        integrationProviderId: integrationProvider.id
      }))
    );

    let last = integrationProviders[integrationProviders.length - 1];
    if (last) {
      await callbackReconcileForIntegrationManyQueue.add({
        integrationId: d.integrationId,
        cursor: last.id
      });
    }
  }

  async reconcileCallbackForIntegrationProvider(d: {
    integrationProviderId: string;
    input?: { name?: string; description?: string | null };
  }) {
    return await callbackLock.usingLock(d.integrationProviderId, async () =>
      this.reconcileCallbackForIntegrationProviderLocked(d)
    );
  }

  private async reconcileCallbackForIntegrationProviderLocked(d: {
    integrationProviderId: string;
    input?: { name?: string; description?: string | null };
  }) {
    let integrationProvider = await db.integrationProvider.findUnique({
      where: { id: d.integrationProviderId },
      include: reconcileIntegrationProviderInclude
    });
    if (!integrationProvider) return null;

    let callback = await db.callback.findFirst({
      where: { integrationProviderOid: integrationProvider.oid, status: 'active' },
      include: callbackInclude,
      orderBy: { oid: 'desc' }
    });

    if (this.isCallbackDesired(integrationProvider)) {
      if (!callback) {
        callback = await this.createCallback({ integrationProvider, input: d.input });
      } else if (callback.syncStatus !== 'synced') {
        await enqueueCallbackPush({ callbackId: callback.id });
      }
    } else if (callback) {
      let callbackInstances = await db.callbackInstance.findMany({
        where: { callbackOid: callback.oid, status: 'active' },
        select: { integrationInstanceProvider: { select: { id: true } } }
      });

      if (callbackInstances.length) {
        await callbackInstanceReconcileQueue.addMany(
          Array.from(
            new Set(
              callbackInstances.map(
                callbackInstance => callbackInstance.integrationInstanceProvider.id
              )
            )
          ).map(integrationInstanceProviderId => ({ integrationInstanceProviderId }))
        );
      } else {
        await this.archiveCallback({ callback, tenant: integrationProvider.tenant });
      }
    }

    await callbackInstanceReconcileManyQueue.add({
      integrationProviderId: integrationProvider.id
    });

    return await db.callback.findFirst({
      where: { integrationProviderOid: integrationProvider.oid, status: 'active' },
      include: callbackInclude,
      orderBy: { oid: 'desc' }
    });
  }

  private isCallbackDesired(integrationProvider: ReconcileIntegrationProvider) {
    return (
      integrationProvider.areCallbacksEnabled &&
      integrationProvider.status === 'active' &&
      integrationProvider.integration.status === 'active' &&
      !integrationProvider.tenant.disableCallbacks &&
      integrationProvider.provider.type.attributes.triggers.status === 'enabled' &&
      !!integrationProvider.provider.defaultVariant
    );
  }

  private async createCallback(d: {
    integrationProvider: ReconcileIntegrationProvider;
    input?: { name?: string; description?: string | null };
  }) {
    let { provider } = d.integrationProvider;

    let providerVariant = provider.defaultVariant;
    if (!providerVariant) return null;

    let callback = await db.callback.create({
      data: {
        ...getId('callback'),
        status: 'active',
        syncStatus: 'pending',

        name: d.input?.name?.trim() || d.integrationProvider.name,
        description:
          d.input?.description === undefined
            ? d.integrationProvider.description
            : d.input.description?.trim() || null,

        integrationOid: d.integrationProvider.integrationOid,
        integrationProviderOid: d.integrationProvider.oid,
        providerOid: provider.oid,
        providerVariantOid: providerVariant.oid,

        tenantOid: d.integrationProvider.tenantOid,
        projectOid: d.integrationProvider.projectOid!,
        environmentOid: d.integrationProvider.environmentOid,
        instanceOid: d.integrationProvider.instanceOid!,
        solutionOid: d.integrationProvider.solutionOid
      },
      include: callbackInclude
    });

    await enqueueCallbackPush({ callbackId: callback.id });

    return callback;
  }

  async pushCallbackById(d: { callbackId: string }) {
    let callback = await db.callback.findUnique({ where: { id: d.callbackId } });
    if (!callback || callback.status !== 'active') return;

    let integrationProvider = await db.integrationProvider.findUniqueOrThrow({
      where: { oid: callback.integrationProviderOid },
      include: reconcileIntegrationProviderInclude
    });

    return await callbackLock.usingLock(integrationProvider.id, async () => {
      let [currentCallback, currentIntegrationProvider] = await Promise.all([
        db.callback.findUnique({ where: { id: d.callbackId } }),
        db.integrationProvider.findUnique({
          where: { id: integrationProvider.id },
          include: reconcileIntegrationProviderInclude
        })
      ]);
      if (
        !currentCallback ||
        !currentIntegrationProvider ||
        currentCallback.status !== 'active' ||
        !this.isCallbackDesired(currentIntegrationProvider)
      ) {
        return;
      }

      return await this.pushCallback({
        callback: currentCallback,
        tenant: currentIntegrationProvider.tenant
      });
    });
  }

  private async pushCallback(d: { callback: Callback; tenant: Tenant }) {
    let [provider, providerVariant] = await Promise.all([
      db.provider.findUniqueOrThrow({ where: { oid: d.callback.providerOid } }),
      db.providerVariant.findUniqueOrThrow({ where: { oid: d.callback.providerVariantOid } })
    ]);

    let callbacks = await getCallbacksBackend(providerVariant);
    if (!callbacks) {
      return await this.markCallbackSyncFailed(d.callback, {
        code: 'callbacks_not_supported',
        message: 'This provider does not support callbacks.'
      });
    }

    try {
      await callbacks.createCallback({
        tenant: d.tenant,
        provider,
        providerVariant,
        callback: d.callback
      });
    } catch (error) {
      return await this.markCallbackSyncFailed(d.callback, toSyncError(error));
    }

    await db.callback.update({
      where: { oid: d.callback.oid },
      data: {
        syncStatus: 'synced',
        lastSyncErrorCode: null,
        lastSyncErrorMessage: null,
        lastSyncedAt: new Date()
      }
    });

    await callbackInstanceReconcileManyQueue.add({
      integrationProviderId: (
        await db.integrationProvider.findUniqueOrThrow({
          where: { oid: d.callback.integrationProviderOid },
          select: { id: true }
        })
      ).id
    });
  }

  private async markCallbackSyncFailed(callback: Callback, error: SyncError) {
    return await db.callback.update({
      where: { oid: callback.oid },
      data: {
        syncStatus: 'failed',
        lastSyncErrorCode: error.code,
        lastSyncErrorMessage: error.message
      }
    });
  }

  private async archiveCallback(d: { callback: CallbackWithRelations; tenant: Tenant }) {
    let providerVariant = await db.providerVariant.findUniqueOrThrow({
      where: { oid: d.callback.providerVariantOid }
    });

    let callbacks = await getCallbacksBackend(providerVariant);
    try {
      await callbacks?.deleteCallback({ tenant: d.tenant, callback: d.callback });
    } catch (error) {
      await this.markCallbackSyncFailed(d.callback, toSyncError(error));
      return false;
    }

    await db.callback.update({
      where: { oid: d.callback.oid },
      data: { status: 'archived', archivedAt: new Date() }
    });

    await db.callbackInstance.updateMany({
      where: { callbackOid: d.callback.oid, status: { not: 'deleted' } },
      data: { isParentDeleted: true }
    });

    return true;
  }

  async reconcileCallbackInstancesForIntegrationProvider(d: {
    integrationProviderId: string;
    cursor?: string;
  }) {
    let integrationProvider = await db.integrationProvider.findUnique({
      where: { id: d.integrationProviderId },
      select: { oid: true, id: true }
    });
    if (!integrationProvider) return;

    let integrationInstanceProviders = await db.integrationInstanceProvider.findMany({
      where: {
        integrationProviderOid: integrationProvider.oid,
        id: d.cursor ? { gt: d.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (integrationInstanceProviders.length === 0) return;

    await callbackInstanceReconcileQueue.addMany(
      integrationInstanceProviders.map(integrationInstanceProvider => ({
        integrationInstanceProviderId: integrationInstanceProvider.id
      }))
    );

    let last = integrationInstanceProviders[integrationInstanceProviders.length - 1];
    if (!last) return;

    await callbackInstanceReconcileManyQueue.add({
      integrationProviderId: integrationProvider.id,
      cursor: last.id
    });
  }

  async reconcileCallbackInstancesForIntegrationInstance(d: {
    integrationInstanceId: string;
    cursor?: string;
  }) {
    let integrationInstance = await db.integrationInstance.findUnique({
      where: { id: d.integrationInstanceId },
      select: { oid: true }
    });
    if (!integrationInstance) return;

    let providers = await db.integrationInstanceProvider.findMany({
      where: {
        integrationInstanceOid: integrationInstance.oid,
        id: d.cursor ? { gt: d.cursor } : undefined
      },
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true }
    });
    if (!providers.length) return;

    await callbackInstanceReconcileQueue.addMany(
      providers.map(provider => ({ integrationInstanceProviderId: provider.id }))
    );

    let last = providers[providers.length - 1];
    if (last) {
      await callbackInstanceReconcileForIntegrationInstanceManyQueue.add({
        integrationInstanceId: d.integrationInstanceId,
        cursor: last.id
      });
    }
  }

  async reconcileCallbackInstanceForIntegrationInstanceProvider(d: {
    integrationInstanceProviderId: string;
  }) {
    return await callbackInstanceLock.usingLock(d.integrationInstanceProviderId, async () =>
      this.reconcileCallbackInstanceForIntegrationInstanceProviderLocked(d)
    );
  }

  private async reconcileCallbackInstanceForIntegrationInstanceProviderLocked(d: {
    integrationInstanceProviderId: string;
  }) {
    let integrationInstanceProvider = await db.integrationInstanceProvider.findUnique({
      where: { id: d.integrationInstanceProviderId },
      include: reconcileIntegrationInstanceProviderInclude
    });
    if (!integrationInstanceProvider) return;

    let callback = await db.callback.findFirst({
      where: {
        integrationProviderOid: integrationInstanceProvider.integrationProviderOid,
        status: 'active'
      },
      orderBy: { oid: 'desc' }
    });

    let isDesired =
      !!callback &&
      callback.syncStatus === 'synced' &&
      integrationInstanceProvider.status === 'active' &&
      !integrationInstanceProvider.isParentDeleted &&
      integrationInstanceProvider.integrationProvider.status === 'active' &&
      integrationInstanceProvider.integrationProvider.areCallbacksEnabled &&
      !integrationInstanceProvider.tenant.disableCallbacks &&
      integrationInstanceProvider.integrationProvider.provider.type.attributes.triggers
        .status === 'enabled' &&
      integrationInstanceProvider.integrationProvider.integration.status === 'active' &&
      integrationInstanceProvider.integrationInstance.status === 'active' &&
      !integrationInstanceProvider.integrationInstance.isParentDeleted;

    let configVersion = integrationInstanceProvider.currentVersion?.config?.currentVersion;
    let authConfigVersion =
      integrationInstanceProvider.currentVersion?.authConfig?.currentVersion ?? null;
    isDesired = isDesired && !!configVersion;

    let active = await db.callbackInstance.findMany({
      where: {
        integrationInstanceProviderOid: integrationInstanceProvider.oid,
        status: 'active'
      },
      include: { callback: true }
    });

    if (!isDesired) {
      for (let callbackInstance of active) {
        await this.archiveCallbackInstance({
          callbackInstance,
          tenant: integrationInstanceProvider.tenant
        });
      }

      return;
    }

    let generations = selectCallbackInstanceGenerations({
      active,
      callbackOid: callback!.oid,
      providerConfigVersionOid: configVersion!.oid,
      providerAuthConfigVersionOid: authConfigVersion?.oid ?? null
    });

    let primary = generations.primary;
    if (primary) {
      if (primary.syncStatus !== 'synced') {
        await enqueueCallbackInstancePush({ callbackInstanceId: primary.id });
      }

      for (let callbackInstance of active) {
        if (callbackInstance.oid === primary.oid) continue;
        await this.archiveCallbackInstance({
          callbackInstance,
          tenant: integrationInstanceProvider.tenant
        });
      }
      return;
    }

    let provisioning = generations.provisioning;
    if (provisioning) {
      await enqueueCallbackInstancePush({ callbackInstanceId: provisioning.id });
      return;
    }

    await this.createCallbackInstanceRecord({
      callback: callback!,
      integrationInstanceProvider,
      providerConfigVersionOid: configVersion!.oid,
      providerAuthConfigVersionOid: authConfigVersion?.oid ?? null,
      push: true
    });
  }

  private async createCallbackInstanceRecord(d: {
    callback: Pick<Callback, 'oid'>;
    integrationInstanceProvider: Pick<
      IntegrationInstanceProvider,
      | 'oid'
      | 'integrationInstanceOid'
      | 'tenantOid'
      | 'projectOid'
      | 'environmentOid'
      | 'instanceOid'
      | 'solutionOid'
    >;
    providerConfigVersionOid: bigint;
    providerAuthConfigVersionOid: bigint | null;
    push: boolean;
  }) {
    let callbackInstance = await db.callbackInstance.create({
      data: {
        ...getId('callbackInstance'),
        status: 'active',
        syncStatus: 'pending',
        generationStatus: 'provisioning',

        callbackOid: d.callback.oid,

        integrationInstanceOid: d.integrationInstanceProvider.integrationInstanceOid,
        integrationInstanceProviderOid: d.integrationInstanceProvider.oid,
        providerConfigVersionOid: d.providerConfigVersionOid,
        providerAuthConfigVersionOid: d.providerAuthConfigVersionOid,

        tenantOid: d.integrationInstanceProvider.tenantOid,
        projectOid: d.integrationInstanceProvider.projectOid!,
        environmentOid: d.integrationInstanceProvider.environmentOid,
        instanceOid: d.integrationInstanceProvider.instanceOid!,
        solutionOid: d.integrationInstanceProvider.solutionOid
      }
    });

    if (d.push) await enqueueCallbackInstancePush({ callbackInstanceId: callbackInstance.id });

    return callbackInstance;
  }

  async pushCallbackInstanceById(d: { callbackInstanceId: string }) {
    let callbackInstance = await db.callbackInstance.findUnique({
      where: { id: d.callbackInstanceId },
      select: { integrationInstanceProvider: { select: { id: true } } }
    });
    if (!callbackInstance) return;

    return await callbackInstanceLock.usingLock(
      callbackInstance.integrationInstanceProvider.id,
      async () => {
        let currentCallbackInstance = await db.callbackInstance.findUnique({
          where: { id: d.callbackInstanceId }
        });
        if (!currentCallbackInstance || currentCallbackInstance.status !== 'active') return;

        let [callback, integrationInstanceProvider] = await Promise.all([
          db.callback.findUniqueOrThrow({
            where: { oid: currentCallbackInstance.callbackOid }
          }),
          db.integrationInstanceProvider.findUniqueOrThrow({
            where: { oid: currentCallbackInstance.integrationInstanceProviderOid },
            include: reconcileIntegrationInstanceProviderInclude
          })
        ]);

        return await this.pushCallbackInstance({
          callback,
          callbackInstance: currentCallbackInstance,
          integrationInstanceProvider,
          tenant: integrationInstanceProvider.tenant
        });
      }
    );
  }

  private async pushCallbackInstance(d: {
    callback: Callback;
    callbackInstance: CallbackInstance;
    integrationInstanceProvider: ReconcileIntegrationInstanceProvider;
    tenant: Tenant;
  }) {
    let currentConfigVersion =
      d.integrationInstanceProvider.currentVersion?.config?.currentVersion;
    let currentAuthConfigVersion =
      d.integrationInstanceProvider.currentVersion?.authConfig?.currentVersion ?? null;
    let isDesired =
      d.callback.status === 'active' &&
      d.callback.syncStatus === 'synced' &&
      d.integrationInstanceProvider.status === 'active' &&
      !d.integrationInstanceProvider.isParentDeleted &&
      d.integrationInstanceProvider.integrationProvider.status === 'active' &&
      d.integrationInstanceProvider.integrationProvider.areCallbacksEnabled &&
      !d.integrationInstanceProvider.tenant.disableCallbacks &&
      d.integrationInstanceProvider.integrationProvider.provider.type.attributes.triggers
        .status === 'enabled' &&
      d.integrationInstanceProvider.integrationProvider.integration.status === 'active' &&
      d.integrationInstanceProvider.integrationInstance.status === 'active' &&
      !d.integrationInstanceProvider.integrationInstance.isParentDeleted &&
      currentConfigVersion?.oid === d.callbackInstance.providerConfigVersionOid &&
      (currentAuthConfigVersion?.oid ?? null) ===
        d.callbackInstance.providerAuthConfigVersionOid;

    if (!isDesired) {
      await db.callbackInstance.update({
        where: { oid: d.callbackInstance.oid },
        data: { generationStatus: 'replaced' }
      });
      await callbackInstanceReconcileQueue.add({
        integrationInstanceProviderId: d.integrationInstanceProvider.id
      });
      return;
    }

    let configVersion = d.callbackInstance.providerConfigVersionOid
      ? await db.providerConfigVersion.findUnique({
          where: { oid: d.callbackInstance.providerConfigVersionOid }
        })
      : null;
    if (!configVersion) {
      return await this.markCallbackInstanceSyncFailed(d.callbackInstance, {
        code: 'provider_config_missing',
        message:
          'This integration instance provider has no materialized provider config to attach a callback to.'
      });
    }

    let providerVariant = await db.providerVariant.findUniqueOrThrow({
      where: { oid: d.callback.providerVariantOid }
    });

    let callbacks = await getCallbacksBackend(providerVariant);
    if (!callbacks) {
      return await this.markCallbackInstanceSyncFailed(d.callbackInstance, {
        code: 'callbacks_not_supported',
        message: 'This provider does not support callbacks.'
      });
    }

    try {
      await callbacks.createCallbackInstance({
        tenant: d.tenant,
        callback: d.callback,
        callbackInstance: d.callbackInstance,
        configVersion,
        authConfigVersion: d.callbackInstance.providerAuthConfigVersionOid
          ? await db.providerAuthConfigVersion.findUniqueOrThrow({
              where: { oid: d.callbackInstance.providerAuthConfigVersionOid }
            })
          : null
      });
    } catch (error) {
      return await this.markCallbackInstanceSyncFailed(d.callbackInstance, toSyncError(error));
    }

    let synced = await db.callbackInstance.update({
      where: { oid: d.callbackInstance.oid },
      data: {
        syncStatus: 'synced',
        lastSyncErrorCode: null,
        lastSyncErrorMessage: null,
        lastSyncedAt: new Date()
      }
    });

    let current = await db.integrationInstanceProvider.findUnique({
      where: { oid: d.callbackInstance.integrationInstanceProviderOid },
      include: reconcileIntegrationInstanceProviderInclude
    });
    currentConfigVersion = current?.currentVersion?.config?.currentVersion;
    currentAuthConfigVersion = current?.currentVersion?.authConfig?.currentVersion ?? null;
    let isCurrent =
      current?.status === 'active' &&
      !current.isParentDeleted &&
      current.integrationProvider.status === 'active' &&
      current.integrationProvider.areCallbacksEnabled &&
      !current.tenant.disableCallbacks &&
      current.integrationProvider.provider.type.attributes.triggers.status === 'enabled' &&
      current.integrationProvider.integration.status === 'active' &&
      current.integrationInstance.status === 'active' &&
      !current.integrationInstance.isParentDeleted &&
      currentConfigVersion?.oid === synced.providerConfigVersionOid &&
      (currentAuthConfigVersion?.oid ?? null) === synced.providerAuthConfigVersionOid;

    if (!isCurrent) {
      await db.callbackInstance.update({
        where: { oid: synced.oid },
        data: { generationStatus: 'replaced' }
      });
    } else {
      await withTransaction(async db => {
        await db.callbackInstance.updateMany({
          where: {
            integrationInstanceProviderOid: synced.integrationInstanceProviderOid,
            status: 'active',
            generationStatus: 'primary',
            oid: { not: synced.oid }
          },
          data: { generationStatus: 'replaced' }
        });
        await db.callbackInstance.update({
          where: { oid: synced.oid },
          data: { generationStatus: 'primary' }
        });
      });
    }

    await callbackInstanceReconcileQueue.add({
      integrationInstanceProviderId: d.integrationInstanceProvider.id
    });
    return synced;
  }

  private async markCallbackInstanceSyncFailed(
    callbackInstance: CallbackInstance,
    error: SyncError
  ) {
    return await db.callbackInstance.update({
      where: { oid: callbackInstance.oid },
      data: {
        syncStatus: 'failed',
        lastSyncErrorCode: error.code,
        lastSyncErrorMessage: error.message
      }
    });
  }

  private async archiveCallbackInstance(d: {
    callbackInstance: CallbackInstance & { callback: Callback };
    tenant: Tenant;
  }) {
    let providerVariant = await db.providerVariant.findUniqueOrThrow({
      where: { oid: d.callbackInstance.callback.providerVariantOid }
    });

    let callbacks = await getCallbacksBackend(providerVariant);

    try {
      await callbacks?.deleteCallbackInstance({
        tenant: d.tenant,
        callback: d.callbackInstance.callback,
        callbackInstance: d.callbackInstance
      });
    } catch (error) {
      await this.markCallbackInstanceSyncFailed(d.callbackInstance, toSyncError(error));
      return false;
    }

    await db.callbackInstance.update({
      where: { oid: d.callbackInstance.oid },
      data: {
        status: 'archived',
        archivedAt: new Date(),
        syncStatus: 'synced',
        lastSyncErrorCode: null,
        lastSyncErrorMessage: null,
        lastSyncedAt: new Date()
      }
    });

    let integrationProvider = await db.integrationProvider.findUnique({
      where: { oid: d.callbackInstance.callback.integrationProviderOid },
      select: { id: true }
    });
    if (integrationProvider) {
      await callbackReconcileQueue.add({
        integrationProviderId: integrationProvider.id
      });
    }
    return true;
  }
}

export let callbackInternalService = Service.create(
  'callbackInternal',
  () => new callbackInternalServiceImpl()
).build();
