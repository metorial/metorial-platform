import { Service } from '@lowerdeck/service';
import {
  type Callback,
  type CallbackInstance,
  db,
  getId,
  type IntegrationInstanceProvider,
  type ProviderVariant,
  type Tenant
} from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import type { IProviderCallbacks } from '@metorial-subspace/provider-utils';
import {
  callbackInclude,
  type CallbackWithRelations,
  type ReconcileIntegrationInstanceProvider,
  reconcileIntegrationInstanceProviderInclude,
  type ReconcileIntegrationProvider,
  reconcileIntegrationProviderInclude
} from '../lib/callbackIncludes';
import { toSyncError } from '../lib/syncError';
import { enqueueCallbackPush } from '../queues/push/callback';
import { enqueueCallbackInstancePush } from '../queues/push/callbackInstance';
import {
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

class callbackInternalServiceImpl {
  async reconcileCallbackForIntegrationProvider(d: {
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
      } else if (callback.syncStatus === 'failed') {
        await enqueueCallbackPush({ callbackId: callback.id });
      }
    } else if (callback) {
      await this.archiveCallback({ callback, tenant: integrationProvider.tenant });
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

    let tenant = await db.tenant.findUniqueOrThrow({ where: { oid: callback.tenantOid } });

    return await this.pushCallback({ callback, tenant });
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
    await callbacks?.deleteCallback({ tenant: d.tenant, callback: d.callback });

    await db.callback.update({
      where: { oid: d.callback.oid },
      data: { status: 'archived', archivedAt: new Date() }
    });

    await db.callbackInstance.updateMany({
      where: { callbackOid: d.callback.oid, status: { not: 'deleted' } },
      data: { isParentDeleted: true }
    });
  }

  async createCallbackInstancesForNewIntegrationInstanceProviders(d: {
    integrationInstanceProviders: Pick<
      IntegrationInstanceProvider,
      | 'oid'
      | 'integrationProviderOid'
      | 'integrationInstanceOid'
      | 'tenantOid'
      | 'projectOid'
      | 'environmentOid'
      | 'instanceOid'
      | 'solutionOid'
    >[];
  }) {
    if (!d.integrationInstanceProviders.length) return;

    let integrationProviderOids = Array.from(
      new Set(d.integrationInstanceProviders.map(provider => provider.integrationProviderOid))
    );

    let callbacks = await db.callback.findMany({
      where: { integrationProviderOid: { in: integrationProviderOids }, status: 'active' }
    });
    if (!callbacks.length) return;

    let callbackByIntegrationProviderOid = new Map(
      callbacks.map(callback => [callback.integrationProviderOid.toString(), callback])
    );

    for (let integrationInstanceProvider of d.integrationInstanceProviders) {
      let callback = callbackByIntegrationProviderOid.get(
        integrationInstanceProvider.integrationProviderOid.toString()
      );
      if (!callback) continue;

      let existingActive = await db.callbackInstance.findFirst({
        where: {
          callbackOid: callback.oid,
          integrationInstanceProviderOid: integrationInstanceProvider.oid,
          status: 'active'
        },
        select: { oid: true }
      });
      if (existingActive) continue;

      await this.createCallbackInstanceRecord({
        callback,
        integrationInstanceProvider,
        push: callback.syncStatus === 'synced'
      });
    }
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

    await callbackInstanceReconcileQueue.addManyWithOps(
      integrationInstanceProviders.map(integrationInstanceProvider => ({
        data: { integrationInstanceProviderId: integrationInstanceProvider.id },
        opts: { id: integrationInstanceProvider.id }
      }))
    );

    let last = integrationInstanceProviders[integrationInstanceProviders.length - 1];
    if (!last) return;

    await callbackInstanceReconcileManyQueue.add({
      integrationProviderId: integrationProvider.id,
      cursor: last.id
    });
  }

  async reconcileCallbackInstanceForIntegrationInstanceProvider(d: {
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
      integrationInstanceProvider.status === 'active' &&
      !integrationInstanceProvider.isParentDeleted;

    let active = await db.callbackInstance.findMany({
      where: {
        integrationInstanceProviderOid: integrationInstanceProvider.oid,
        status: 'active'
      },
      include: { callback: true }
    });

    let desired = isDesired
      ? active.find(callbackInstance => callbackInstance.callbackOid === callback!.oid)
      : undefined;

    for (let callbackInstance of active) {
      if (callbackInstance === desired) continue;

      await this.archiveCallbackInstance({
        callbackInstance,
        tenant: integrationInstanceProvider.tenant
      });
    }

    if (!isDesired) return;

    if (callback!.syncStatus !== 'synced') return;

    if (desired) {
      if (desired.syncStatus === 'synced') return;

      await enqueueCallbackInstancePush({ callbackInstanceId: desired.id });
      return;
    }

    await this.createCallbackInstanceRecord({
      callback: callback!,
      integrationInstanceProvider,
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
    push: boolean;
  }) {
    let callbackInstance = await db.callbackInstance.create({
      data: {
        ...getId('callbackInstance'),
        status: 'active',
        syncStatus: 'pending',

        callbackOid: d.callback.oid,

        integrationInstanceOid: d.integrationInstanceProvider.integrationInstanceOid,
        integrationInstanceProviderOid: d.integrationInstanceProvider.oid,

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
      where: { id: d.callbackInstanceId }
    });
    if (!callbackInstance || callbackInstance.status !== 'active') return;

    let [callback, integrationInstanceProvider] = await Promise.all([
      db.callback.findUniqueOrThrow({ where: { oid: callbackInstance.callbackOid } }),
      db.integrationInstanceProvider.findUniqueOrThrow({
        where: { oid: callbackInstance.integrationInstanceProviderOid },
        include: reconcileIntegrationInstanceProviderInclude
      })
    ]);

    return await this.pushCallbackInstance({
      callback,
      callbackInstance,
      integrationInstanceProvider,
      tenant: integrationInstanceProvider.tenant
    });
  }

  private async pushCallbackInstance(d: {
    callback: Callback;
    callbackInstance: CallbackInstance;
    integrationInstanceProvider: ReconcileIntegrationInstanceProvider;
    tenant: Tenant;
  }) {
    let configVersion = d.integrationInstanceProvider.currentVersion?.config?.currentVersion;
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
        authConfigVersion:
          d.integrationInstanceProvider.currentVersion?.authConfig?.currentVersion ?? null
      });
    } catch (error) {
      return await this.markCallbackInstanceSyncFailed(d.callbackInstance, toSyncError(error));
    }

    return await db.callbackInstance.update({
      where: { oid: d.callbackInstance.oid },
      data: {
        syncStatus: 'synced',
        lastSyncErrorCode: null,
        lastSyncErrorMessage: null,
        lastSyncedAt: new Date()
      }
    });
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

    await callbacks?.deleteCallbackInstance({
      tenant: d.tenant,
      callback: d.callbackInstance.callback,
      callbackInstance: d.callbackInstance
    });

    await db.callbackInstance.update({
      where: { oid: d.callbackInstance.oid },
      data: { status: 'archived', archivedAt: new Date() }
    });
  }
}

export let callbackInternalService = Service.create(
  'callbackInternal',
  () => new callbackInternalServiceImpl()
).build();
