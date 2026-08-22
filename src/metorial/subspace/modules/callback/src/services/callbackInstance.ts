import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { randomUUID } from 'node:crypto';
import {
  db,
  getId,
  Prisma,
  withTransaction,
  type Callback,
  type CallbackInstance,
  type Environment,
  type ProviderAuthConfig,
  type ProviderConfig,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type IntegrationInstance,
  type IntegrationInstanceProvider,
  type Tenant
} from '@metorial-subspace/db';
import {
  normalizeDateFilter,
  normalizeStatusForList,
  resolveCallbacks,
  resolveIntegrationInstanceProviders,
  resolveIntegrationInstances,
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
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { getTenantForSlates, slates } from '@metorial-subspace/provider-slates/src/client';
import { tombstoneProvisionedTenantAppsForCallbackInTransaction } from '@metorial-subspace/module-auth';
import { applyCallbackRegistrationMirror } from '../reconciler/lib/sync';
import { callbackService } from './callback';
import { callbackRegistrationService } from './callbackRegistration';

let callbackInstanceInclude = {
  integrationInstance: true,
  integrationInstanceProvider: true,
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

let callbackInstanceRegistrationReset = {
  registrationStatus: 'pending' as const,
  registrationGeneration: 0,
  registrationTransitionVersion: 0,
  registrationErrorCode: null,
  registrationErrorMessage: null,
  registrationErrorMetadata: Prisma.DbNull,
  registrationErrorAt: null,
  registrationPublicSnapshot: Prisma.DbNull,
  registrationMirrorVersion: 0,
  registrationReceiverAuthorityVersion: 0,
  slateTriggerReceiverId: null,
  lastSyncErrorCode: null,
  lastSyncErrorMessage: null,
  lastRegistrationSyncErrorCode: null,
  lastRegistrationSyncErrorMessage: null,
  lastRegistrationSyncErrorAt: null,
  verificationMechanism: null,
  verificationSpecHash: null
};

let callbackInstanceAttachConflict = () =>
  new ServiceError(
    badRequestError({
      code: 'callback_instance_attach_conflict',
      message: 'The callback instance changed while it was being attached.'
    })
  );

let isUniqueConstraintError = (error: any) => error?.code === 'P2002';

export type GetCallbackInstanceParams = {
  callbackId: string;
  callbackInstanceId: string;
};

export type ListCallbackInstancesParams = {
  callbackIds?: string[];
  integrationInstanceIds?: string[];
  integrationInstanceProviderIds?: string[];
  ids?: string[];
  status?: ('attached' | 'detached')[];
  allowDeleted?: boolean;
  providerConfigIds?: string[];
  providerAuthConfigIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type AttachCallbackInstanceInternalParams = {
  callback: Callback & {
    providerDeployment: ProviderDeployment & {
      id: string;
      currentVersion: ProviderDeploymentVersion | null;
    };
  };
  config: ProviderConfig;
  authConfig?: ProviderAuthConfig;
  integrationInstance: IntegrationInstance;
  integrationInstanceProvider: IntegrationInstanceProvider;
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
    let integrationInstances = await resolveIntegrationInstances(ts, d.integrationInstanceIds);
    let integrationInstanceProviders = await resolveIntegrationInstanceProviders(
      ts,
      d.integrationInstanceProviderIds
    );
    let configs = await resolveProviderConfigs(ts, d.providerConfigIds);
    let authConfigs = await resolveProviderAuthConfigs(ts, d.providerAuthConfigIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.callbackInstance.findMany({
          ...opts,
          where: {
            ...normalizeStatusForList(d).onlyParent,
            callback: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid
            },

            AND: [
              callbacks ? { callbackOid: callbacks.in } : undefined!,
              integrationInstances
                ? { integrationInstanceOid: integrationInstances.in }
                : undefined!,
              integrationInstanceProviders
                ? { integrationInstanceProviderOid: integrationInstanceProviders.in }
                : undefined!,
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

  async attachInternal(
    d: { tenant: Tenant; environment: Environment } & AttachCallbackInstanceInternalParams
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

    if (
      d.integrationInstanceProvider.integrationInstanceOid !== d.integrationInstance.oid ||
      d.integrationInstanceProvider.integrationProviderOid !==
        d.callback.integrationProviderOid ||
      d.integrationInstanceProvider.integrationOid !== d.callback.integrationOid ||
      d.integrationInstance.integrationOid !== d.callback.integrationOid
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_instance_integration_mismatch',
          message:
            'The integration instance provider does not belong to the callback integration provider.'
        })
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

    let existing = await db.callbackInstance.findUnique({
      where: {
        callbackOid_integrationInstanceProviderOid: {
          callbackOid: d.callback.oid,
          integrationInstanceProviderOid: d.integrationInstanceProvider.oid
        }
      }
    });
    if (
      existing?.status === 'attached' &&
      (existing.providerDeploymentConfigPairOid !== pairRes.pair.oid ||
        existing.isParentDeleted)
    ) {
      await this.detachInternal({
        tenant: d.tenant,
        environment: d.environment,
        callbackInstance: existing
      });
    }

    existing = await db.callbackInstance.findUnique({
      where: {
        callbackOid_integrationInstanceProviderOid: {
          callbackOid: d.callback.oid,
          integrationInstanceProviderOid: d.integrationInstanceProvider.oid
        }
      }
    });
    let shouldResetRegistration =
      !existing ||
      existing.status !== 'attached' ||
      existing.isParentDeleted ||
      existing.providerDeploymentConfigPairOid !== pairRes.pair.oid;
    if (
      existing &&
      !shouldResetRegistration &&
      existing.integrationInstanceOid === d.integrationInstance.oid &&
      !existing.isParentDeleted
    ) {
      await callbackRegistrationService.syncCallbackInstance({
        callbackInstanceId: existing.id
      });
      return await this.getById({
        callback: d.callback,
        callbackInstanceId: existing.id
      });
    }

    await Fabric.fire('provider.callback_instance.attached:before', {
      callback: d.callback,
      integrationInstanceProvider: d.integrationInstanceProvider
    });
    let callbackInstance;
    if (!existing) {
      try {
        callbackInstance = await db.callbackInstance.create({
          data: {
            ...getId('callbackInstance'),
            callbackOid: d.callback.oid,
            integrationInstanceOid: d.integrationInstance.oid,
            integrationInstanceProviderOid: d.integrationInstanceProvider.oid,
            providerDeploymentConfigPairOid: pairRes.pair.oid,
            status: 'attached',
            registrationStatus: 'pending'
          },
          include: callbackInstanceInclude
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        throw callbackInstanceAttachConflict();
      }
    } else {
      let updated = await db.callbackInstance.updateMany({
        where: {
          oid: existing.oid,
          updatedAt: existing.updatedAt,
          status: existing.status,
          providerDeploymentConfigPairOid: existing.providerDeploymentConfigPairOid,
          slateTriggerReceiverId: existing.slateTriggerReceiverId,
          registrationReceiverAuthorityVersion: existing.registrationReceiverAuthorityVersion
        },
        data: {
          status: 'attached',
          isParentDeleted: false,
          integrationInstanceOid: d.integrationInstance.oid,
          providerDeploymentConfigPairOid: pairRes.pair.oid,
          ...(shouldResetRegistration ? callbackInstanceRegistrationReset : {})
        }
      });
      if (updated.count !== 1) throw callbackInstanceAttachConflict();
      callbackInstance = await db.callbackInstance.findUniqueOrThrow({
        where: { oid: existing.oid },
        include: callbackInstanceInclude
      });
    }

    await callbackRegistrationService.syncCallbackInstance({
      callbackInstanceId: callbackInstance.id
    });

    let attached = await this.getById({
      callback: d.callback,
      callbackInstanceId: callbackInstance.id
    });
    await Fabric.fire('provider.callback_instance.attached:after', {
      callbackInstance: attached
    });
    return attached;
  }

  async detach(d: MetorialFacing<DetachCallbackInstanceParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let callbackInstance = await this.detachInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    return callbackInstance;
  }

  async detachInternal(
    d: { tenant: Tenant; environment: Environment } & DetachCallbackInstanceParams
  ) {
    if (d.callbackInstance.status !== 'attached') return d.callbackInstance;
    await Fabric.fire('provider.callback_instance.detached:before', {
      callbackInstance: d.callbackInstance
    });
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

    let detached = await withTransaction(async db => {
      let now = new Date();
      let transitioned = await db.callbackInstance.updateMany({
        where: {
          oid: d.callbackInstance.oid,
          status: 'attached',
          providerDeploymentConfigPairOid: d.callbackInstance.providerDeploymentConfigPairOid,
          slateTriggerReceiverId: d.callbackInstance.slateTriggerReceiverId
        },
        data: {
          status: 'detached',
          registrationStatus: 'unregistered',
          registrationGeneration: 0,
          registrationTransitionVersion: 0,
          registrationErrorCode: null,
          registrationErrorMessage: null,
          registrationErrorMetadata: Prisma.DbNull,
          registrationErrorAt: null,
          registrationPublicSnapshot: Prisma.DbNull,
          registrationMirrorVersion: 0,
          registrationReceiverAuthorityVersion: 0,
          slateTriggerReceiverId: null,
          lastSyncErrorCode: null,
          lastSyncErrorMessage: null,
          lastRegistrationSyncErrorCode: null,
          lastRegistrationSyncErrorMessage: null,
          lastRegistrationSyncErrorAt: null,
          verificationMechanism: null,
          verificationSpecHash: null,
          lastSyncedAt: now
        }
      });
      if (transitioned.count !== 1) return null;
      await tombstoneProvisionedTenantAppsForCallbackInTransaction(
        db,
        d.callbackInstance.oid,
        now
      );
      return await db.callbackInstance.findUniqueOrThrow({
        where: { oid: d.callbackInstance.oid },
        include: callbackInstanceInclude
      });
    });
    if (!detached) {
      return await db.callbackInstance.findUniqueOrThrow({
        where: { oid: d.callbackInstance.oid },
        include: callbackInstanceInclude
      });
    }
    await Fabric.fire('provider.callback_instance.detached:after', {
      callbackInstance: detached
    });
    return detached;
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
