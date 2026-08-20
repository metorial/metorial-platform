import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
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
import { getTenantForSlates } from '@metorial-subspace/provider-slates/src/client';
import { tombstoneProvisionedTenantAppsForCallbackInTransaction } from '@metorial-subspace/module-auth';
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
      credentialOwnerType: true,
      status: true,
      externalAppId: true,
      githubManifestStateExpiresAt: true,
      githubManifestCompletedAt: true,
      githubInstallationCompletedAt: true
    }
  }
};

class callbackInstanceServiceImpl {
  async get(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    callbackInstanceId: string;
  }) {
    let callback = await callbackService.getCallbackById({
      tenant: d.tenant,
      solution: d.solution,
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

  async detach(d: { tenant: Tenant; callbackInstance: CallbackInstance }) {
    let slatesTenant = await getTenantForSlates(d.tenant);
    let callback = await db.callback.findUniqueOrThrow({
      where: { oid: d.callbackInstance.callbackOid },
      select: { id: true }
    });
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
}

export let callbackInstanceService = Service.create(
  'callbackInstanceService',
  () => new callbackInstanceServiceImpl()
).build();
