import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { randomUUID } from 'node:crypto';
import {
  db,
  getId,
  withTransaction,
  type Callback,
  type CallbackInstance,
  type Environment,
  type ProviderAuthConfig,
  type ProviderConfig,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type Tenant
} from '@metorial-subspace/db';
import {
  normalizeDateFilter,
  normalizeStatusForList,
  resolveCallbacks,
  resolveProviderAuthConfigs,
  resolveProviderConfigs,
  type DateFilter
} from '@metorial-subspace/list-utils';
import {
  providerCombinationService,
  providerDeploymentConfigPairInternalService
} from '@metorial-subspace/module-provider-internal';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { getTenantForSlates, slates } from '@metorial-subspace/provider-slates/src/client';
import { tombstoneProvisionedTenantAppsForCallbackInTransaction } from '@metorial-subspace/module-auth';
import { applyCallbackRegistrationMirror } from '../reconciler/lib/sync';
import { callbackService } from './callback';
import { callbackRegistrationService } from './callbackRegistration';

let callbackInstanceInclude = {
  providerDeploymentConfigPair: {
    include: {
      providerDeploymentVersion: {
        include: {
          deployment: {
            include: {
              provider: true
            }
          }
        }
      },
      providerConfigVersion: {
        include: {
          config: true
        }
      },
      providerAuthConfigVersion: {
        include: {
          authConfig: true
        }
      }
    }
  },
  provisionedTenantApps: {
    select: {
      id: true,
      generation: true,
      vendor: true,
      status: true,
      externalAppId: true,
      externalAccountId: true,
      externalInstallationId: true,
      expiresAt: true
    }
  }
};

export type GetCallbackInstanceParams = {
  callbackId: string;
  callbackInstanceId: string;
};

export type ListCallbackInstancesParams = {
  callbackIds?: string[];
  ids?: string[];
  status?: ('attached' | 'detached')[];
  allowDeleted?: boolean;
  providerConfigIds?: string[];
  providerAuthConfigIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type AttachCallbackInstanceParams = {
  callback: Callback & {
    providerDeployment: ProviderDeployment & {
      id: string;
      currentVersion: ProviderDeploymentVersion | null;
    };
  };
  config: ProviderConfig;
  authConfig?: ProviderAuthConfig;
};

export type DetachCallbackInstanceParams = {
  callbackInstance: CallbackInstance;
};

export type CallbackInstancePathSecretParams = {
  callback: Callback;
  callbackInstance: CallbackInstance;
};

class callbackInstanceServiceImpl {
  async get(d: MetorialFacing<GetCallbackInstanceParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getInternal(
    d: { tenant: Tenant; environment: Environment } & GetCallbackInstanceParams
  ) {
    let callback = await callbackService.getCallbackByIdInternal({
      tenant: d.tenant,
      environment: d.environment,
      callbackId: d.callbackId
    });

    return this.getById({
      callback,
      callbackInstanceId: d.callbackInstanceId
    });
  }

  async getById(d: { callback: Callback; callbackInstanceId: string }) {
    let callbackInstance = await db.callbackInstance.findFirst({
      where: {
        id: d.callbackInstanceId,
        callbackOid: d.callback.oid
      },
      include: callbackInstanceInclude
    });
    if (!callbackInstance) {
      throw new ServiceError(notFoundError('callback.instance', d.callbackInstanceId));
    }

    return callbackInstance;
  }

  async list(d: MetorialFacing<ListCallbackInstancesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listInternal(
    d: { tenant: Tenant; environment: Environment } & ListCallbackInstancesParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };

    let callbacks = await resolveCallbacks(ts, d.callbackIds);
    let configs = await resolveProviderConfigs(ts, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(ts, d.providerAuthConfigIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.callbackInstance.findMany({
          ...opts,
          where: {
            ...normalizeStatusForList(d).onlyParent,

            AND: [
              callbacks ? { callbackOid: callbacks.in } : undefined!,
              d.ids ? { id: { in: d.ids } } : undefined!,
              d.status?.length ? { status: { in: d.status } } : undefined!,
              configs
                ? {
                    providerDeploymentConfigPair: {
                      providerConfigVersion: {
                        configOid: configs.in
                      }
                    }
                  }
                : undefined!,
              authConfigs
                ? {
                    providerDeploymentConfigPair: {
                      providerAuthConfigVersion: {
                        authConfigOid: authConfigs.in
                      }
                    }
                  }
                : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          },
          include: callbackInstanceInclude
        })
      )
    );
  }

  async attach(d: MetorialFacing<AttachCallbackInstanceParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.callback_instance.attached:before', eventBase);

    let callbackInstance = await this.attachInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.callback_instance.attached:after', {
      ...eventBase,
      callbackInstance
    });

    return callbackInstance;
  }

  async attachInternal(
    d: { tenant: Tenant; environment: Environment } & AttachCallbackInstanceParams
  ) {
    if (d.callback.status !== 'active') {
      throw new ServiceError(
        badRequestError({
          code: 'callback_archived',
          message: 'Instances cannot be attached to an archived callback.'
        })
      );
    }

    if (d.callback.providerDeployment.status !== 'active') {
      throw new ServiceError(
        notFoundError('provider.deployment', d.callback.providerDeployment.id)
      );
    }

    let [combination] = await providerCombinationService.getCombinationsInternal({
      tenant: d.tenant,
      environment: d.environment,
      providers: [
        {
          deploymentId: d.callback.providerDeployment.id,
          configId: d.config.id,
          authConfigId: d.authConfig?.id
        }
      ]
    });

    let pairRes = await providerDeploymentConfigPairInternalService.upsertDeploymentConfigPair(
      {
        deployment: d.callback.providerDeployment,
        config: combination.config,
        authConfig: combination.authConfig
      }
    );

    let callbackInstance = await db.callbackInstance.upsert({
      where: {
        callbackOid_providerDeploymentConfigPairOid: {
          callbackOid: d.callback.oid,
          providerDeploymentConfigPairOid: pairRes.pair.oid
        }
      },
      create: {
        ...getId('callbackInstance'),
        callbackOid: d.callback.oid,
        providerDeploymentConfigPairOid: pairRes.pair.oid,
        status: 'attached',
        registrationStatus: 'pending'
      },
      update: {
        status: 'attached'
      },
      include: callbackInstanceInclude
    });

    await callbackRegistrationService.syncCallbackInstance({
      callbackInstanceId: callbackInstance.id
    });

    return await this.getById({
      callback: d.callback,
      callbackInstanceId: callbackInstance.id
    });
  }

  async detach(d: MetorialFacing<DetachCallbackInstanceParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.callback_instance.detached:before', eventBase);

    let callbackInstance = await this.detachInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.callback_instance.detached:after', {
      ...eventBase,
      callbackInstance
    });

    return callbackInstance;
  }

  async detachInternal(
    d: { tenant: Tenant; environment: Environment } & DetachCallbackInstanceParams
  ) {
    let callback = await db.callback.findUniqueOrThrow({
      where: { oid: d.callbackInstance.callbackOid },
      select: { id: true }
    });
    let slatesTenant = await getTenantForSlates(d.tenant);
    await callbackRegistrationService.detachRegistration({
      callbackInstanceOid: d.callbackInstance.oid,
      callbackInstanceId: d.callbackInstance.id,
      callbackId: callback.id,
      slateTriggerReceiverId: d.callbackInstance.slateTriggerReceiverId,
      expectedReceiverAuthorityVersion:
        d.callbackInstance.registrationReceiverAuthorityVersion,
      slatesTenantId: slatesTenant.id
    });

    return await withTransaction(async db => {
      let now = new Date();
      await tombstoneProvisionedTenantAppsForCallbackInTransaction(
        db,
        d.callbackInstance.oid,
        now
      );
      return await db.callbackInstance.update({
        where: { oid: d.callbackInstance.oid },
        data: {
          status: 'detached',
          lastSyncedAt: now
        },
        include: callbackInstanceInclude
      });
    });
  }

  private assertPathSecretOwner(d: CallbackInstancePathSecretParams) {
    if (
      d.callbackInstance.callbackOid !== d.callback.oid ||
      d.callbackInstance.status !== 'attached' ||
      !d.callbackInstance.slateTriggerReceiverId ||
      d.callbackInstance.registrationReceiverAuthorityVersion < 1
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_receiver_unavailable',
          message: 'The callback instance does not have an active receiver.'
        })
      );
    }
  }

  private async mutateReceiverPathSecret(
    d: { tenant: Tenant } & CallbackInstancePathSecretParams,
    operation: 'create' | 'rotate'
  ) {
    this.assertPathSecretOwner(d);
    let slatesTenant = await getTenantForSlates(d.tenant);
    let owner = {
      tenantId: slatesTenant.id,
      callbackId: d.callback.id,
      callbackInstanceId: d.callbackInstance.id,
      slateTriggerReceiverId: d.callbackInstance.slateTriggerReceiverId!,
      expectedOwnerVersion: d.callbackInstance.registrationReceiverAuthorityVersion,
      ownerMutationId: `${operation}-receiver-path:${randomUUID()}`
    };
    let result =
      operation === 'create'
        ? await slates.callbackRegistration.createPathSecret(owner)
        : await slates.callbackRegistration.rotatePathSecret(owner);

    let webhookUrl: string | null = null;
    try {
      let receiver = await slates.callbackRegistration.get({
        tenantId: slatesTenant.id,
        callbackId: d.callback.id,
        callbackInstanceId: d.callbackInstance.id,
        slateTriggerReceiverId: d.callbackInstance.slateTriggerReceiverId!,
        expectedOwnerVersion: d.callbackInstance.registrationReceiverAuthorityVersion
      });
      webhookUrl = receiver.receiverWebhookUrl
        ? `${receiver.receiverWebhookUrl.replace(/\/+$/, '')}/${encodeURIComponent(result.plaintext)}`
        : null;
      await applyCallbackRegistrationMirror({
        callbackInstanceOid: d.callbackInstance.oid,
        receiver,
        expectedReceiverId: d.callbackInstance.slateTriggerReceiverId,
        expectedReceiverAuthorityVersion:
          d.callbackInstance.registrationReceiverAuthorityVersion
      });
    } catch {
      await callbackRegistrationService.enqueueReconcile({
        callbackInstanceId: d.callbackInstance.id
      });
    }

    return {
      pathSecret: result.pathSecret,
      plaintext: result.plaintext,
      webhookUrl
    };
  }

  async createReceiverPathSecret(d: MetorialFacing<CallbackInstancePathSecretParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return await this.mutateReceiverPathSecret({ ...rest, tenant: scope.tenant }, 'create');
  }

  async rotateReceiverPathSecret(d: MetorialFacing<CallbackInstancePathSecretParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return await this.mutateReceiverPathSecret({ ...rest, tenant: scope.tenant }, 'rotate');
  }
}

export let callbackInstanceService = Service.create(
  'callbackInstanceService',
  () => new callbackInstanceServiceImpl()
).build();
