import { internalServerError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  CallbackReceiverRegistrationStatus,
  db,
  getId,
  withTransaction,
  type Callback,
  type CallbackInstance,
  type CallbackReceiverRegistration,
  type Environment,
  type ProviderAuthConfig,
  type ProviderConfig,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type Solution,
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
import { getTenantForSlates, slates } from '@metorial-subspace/provider-slates/src/client';
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

class callbackInstanceServiceImpl {
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

  async list(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    callbackIds?: string[];
    ids?: string[];
    status?: ('attached' | 'detached')[];
    allowDeleted?: boolean;
    providerConfigIds?: string[];
    providerAuthConfigIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let callbacks = await resolveCallbacks(d, d.callbackIds);
    let configs = await resolveProviderConfigs(d, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);

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

  async attach(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callback: Callback & {
      providerDeployment: ProviderDeployment & {
        id: string;
        currentVersion: ProviderDeploymentVersion | null;
      };
    };
    config: ProviderConfig;
    authConfig?: ProviderAuthConfig;
  }) {
    if (d.callback.providerDeployment.status !== 'active') {
      throw new ServiceError(
        notFoundError('provider.deployment', d.callback.providerDeployment.id)
      );
    }

    let [combination] = await providerCombinationService.getCombinations({
      tenant: d.tenant,
      solution: d.solution,
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

    await callbackRegistrationService.enqueueReconcile({
      callbackInstanceId: callbackInstance.id
    });

    return callbackInstance;
  }

  async detach(d: {
    tenant: Tenant;
    callbackInstance: CallbackInstance & {
      activeRegistration: CallbackReceiverRegistration | null;
    };
  }) {
    if (d.callbackInstance.activeRegistration) {
      let slatesTenant = await getTenantForSlates(d.tenant);
      try {
        await slates.slateTriggerReceiver.delete({
          tenantId: slatesTenant.id,
          slateTriggerReceiverId: d.callbackInstance.activeRegistration.slateTriggerReceiverId
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
      if (d.callbackInstance.activeRegistration) {
        await db.callbackReceiverRegistration.update({
          where: { oid: d.callbackInstance.activeRegistration.oid },
          data: {
            status: CallbackReceiverRegistrationStatus.detached,
            lastSyncedAt: new Date()
          }
        });
      }

      return await db.callbackInstance.update({
        where: { oid: d.callbackInstance.oid },
        data: {
          status: 'detached',
          registrationStatus: 'pending',
          activeRegistrationOid: null
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
