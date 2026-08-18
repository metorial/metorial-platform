import {
  badRequestError,
  internalServerError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
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
  resolveMetorialFacing,
  toProviderEventBase,
  type MetorialFacing
} from '@metorial-subspace/module-tenant';
import { getTenantForSlates, slates } from '@metorial-subspace/provider-slates/src/client';
import { Fabric } from '@metorial/fabric';
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
  activeRegistration: true
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
  includeInternal?: boolean;
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
  _allowInternalAttach?: boolean;
};

export type DetachCallbackInstanceParams = {
  callbackInstance: CallbackInstance;
  _allowInternalDetach?: boolean;
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
              !d.includeInternal && !d.callbackIds?.length
                ? { callback: { isInternal: false } }
                : undefined!,
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
    if (d.callback.isInternal && !d._allowInternalAttach) {
      throw new ServiceError(
        badRequestError({
          code: 'internal_callback_readonly',
          message: 'Internal callback instances cannot be attached by customers.'
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

    let callbackInstance = await db.callbackInstance.findFirst({
      where: {
        callbackOid: d.callback.oid,
        providerDeploymentConfigPairOid: pairRes.pair.oid,
        status: 'detached'
      },
      orderBy: {
        updatedAt: 'desc'
      },
      include: callbackInstanceInclude
    });

    if (callbackInstance) {
      callbackInstance = await db.callbackInstance.update({
        where: { oid: callbackInstance.oid },
        data: {
          status: 'attached',
          registrationStatus: 'pending'
        },
        include: callbackInstanceInclude
      });
    } else {
      callbackInstance = await db.callbackInstance.create({
        data: {
          ...getId('callbackInstance'),
          callbackOid: d.callback.oid,
          providerDeploymentConfigPairOid: pairRes.pair.oid,
          status: 'attached',
          registrationStatus: 'pending'
        },
        include: callbackInstanceInclude
      });
    }

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
      where: { oid: d.callbackInstance.callbackOid }
    });
    if (callback.isInternal && !d._allowInternalDetach) {
      throw new ServiceError(
        badRequestError({
          code: 'internal_callback_readonly',
          message: 'Internal callback instances cannot be detached by customers.'
        })
      );
    }

    if (d.callbackInstance.slateTriggerReceiverId) {
      let slatesTenant = await getTenantForSlates(d.tenant);
      try {
        await slates.callbackRegistration.delete({
          tenantId: slatesTenant.id,
          slateTriggerReceiverId: d.callbackInstance.slateTriggerReceiverId
        });
      } catch (err: any) {
        throw new ServiceError(
          internalServerError({
            details: err?.data?.message
          })
        );
      }
    }

    return await withTransaction(async db => {
      return await db.callbackInstance.update({
        where: { oid: d.callbackInstance.oid },
        data: {
          status: 'detached',
          registrationStatus: 'pending',
          activeRegistrationOid: null,
          slateTriggerReceiverId: null,
          lastSyncedAt: new Date()
        },
        include: callbackInstanceInclude
      });
    });
  }
}

export let callbackInstanceService = Service.create(
  'callbackInstanceService',
  () => new callbackInstanceServiceImpl()
).build();
