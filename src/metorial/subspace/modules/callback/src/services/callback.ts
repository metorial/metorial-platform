import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type Callback,
  CallbackDestinationStatus,
  db,
  type Environment,
  getId,
  type IntegrationProvider,
  snowflake,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveIntegrationProviders,
  resolveIntegrations,
  resolveProviderDeployments
} from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { resolveCallbackProviderTriggers } from '../lib/resolveCallbackProviderTriggers';
import { callbackConfigBackingDeleteQueue } from '../queues/deleteCallbackConfigBacking';
import { callbackConfigService } from './callbackConfig';
import { callbackDestinationService } from './callbackDestination';
import { callbackRegistrationService } from './callbackRegistration';

let MAX_DESTINATIONS_PER_CALLBACK = 100;
let MAX_TRIGGERS_PER_CALLBACK = 100;

let callbackInclude = {
  integration: true,
  integrationProvider: true,
  providerDeployment: {
    include: {
      provider: {
        include: {
          type: true
        }
      },
      currentVersion: true
    }
  },
  callbackProviderTriggers: {
    include: {
      providerTrigger: true
    }
  },
  callbackDestinationLinks: {
    where: {
      callbackDestination: {
        status: CallbackDestinationStatus.active
      }
    },
    include: {
      callbackDestination: true
    }
  },
  callbackConfig: {
    include: {
      currentVersion: true
    }
  }
};

export type ListCallbacksParams = {
  status?: ('active' | 'archived' | 'deleted')[];
  allowDeleted?: boolean;
  ids?: string[];
  providerDeploymentIds?: string[];
  integrationIds?: string[];
  integrationProviderIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetCallbackByIdParams = {
  callbackId: string;
  allowDeleted?: boolean;
};

export type UpsertCallbackForIntegrationProviderParams = {
  integrationProvider: IntegrationProvider;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    pollIntervalSecondsOverride?: number | null;
    triggers: { triggerId: string; eventTypes?: string[] }[];
    destinationIds?: string[];
    configValues?: Record<string, string>;
  };
};

export type GetCallbackForIntegrationProviderParams = {
  integrationProvider: IntegrationProvider;
};

export type GetCallbackConfigSchemaForIntegrationProviderParams = {
  integrationProvider: IntegrationProvider;
  triggerIds: string[];
};

export type ArchiveCallbackParams = {
  callback: Callback;
};

class callbackServiceImpl {
  private normalizePollInterval(value?: number | null) {
    if (value === undefined || value === null) return value;
    if (!Number.isInteger(value) || value < 1) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_poll_interval',
          message: 'pollIntervalSecondsOverride must be a positive integer.'
        })
      );
    }

    return value;
  }

  private validateTriggerSelection(triggers: { triggerId: string; eventTypes?: string[] }[]) {
    if (triggers.length === 0) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_requires_trigger',
          message: 'A callback must reference at least one trigger.'
        })
      );
    }
    if (triggers.length > MAX_TRIGGERS_PER_CALLBACK) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_trigger_limit_exceeded',
          message: `A callback can reference at most ${MAX_TRIGGERS_PER_CALLBACK} triggers.`
        })
      );
    }
  }

  async listCallbacks(d: MetorialFacing<ListCallbacksParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listCallbacksInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listCallbacksInternal(
    d: { tenant: Tenant; environment: Environment } & ListCallbacksParams
  ) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);
    let integrations = await resolveIntegrations(ts, d.integrationIds);
    let integrationProviders = await resolveIntegrationProviders(ts, d.integrationProviderIds);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.callback.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,
            ...normalizeStatusForList(d).noParent,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
              deployments ? { providerDeploymentOid: deployments.in } : undefined!,
              integrations ? { integrationOid: integrations.in } : undefined!,
              integrationProviders
                ? { integrationProviderOid: integrationProviders.in }
                : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          },
          include: callbackInclude
        })
      )
    );
  }

  async getCallbackById(d: MetorialFacing<GetCallbackByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getCallbackByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getCallbackByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetCallbackByIdParams
  ) {
    let solution = await getMetorialSolution();

    let callback = await db.callback.findFirst({
      where: {
        id: d.callbackId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: callbackInclude
    });
    if (!callback) {
      throw new ServiceError(notFoundError('callback', d.callbackId));
    }

    return callback;
  }

  private async getIntegrationProviderAndDeployment(d: {
    tenant: Tenant;
    environment: Environment;
    integrationProvider: IntegrationProvider;
  }) {
    let solution = await getMetorialSolution();

    let integrationProvider = await db.integrationProvider.findFirst({
      where: {
        oid: d.integrationProvider.oid,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        status: 'active'
      },
      include: {
        integration: true,
        currentVersion: {
          include: {
            deployment: {
              include: {
                provider: {
                  include: {
                    type: true,
                    defaultVariant: true
                  }
                },
                currentVersion: {
                  include: {
                    lockedVersion: true
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!integrationProvider) {
      throw new ServiceError(notFoundError('integration.provider', d.integrationProvider.id));
    }
    if (integrationProvider.integrationOid !== integrationProvider.integration.oid) {
      throw new Error('Integration provider ownership invariant is invalid');
    }
    if (!integrationProvider.currentVersion) {
      throw new ServiceError(
        badRequestError({
          code: 'integration_provider_version_required',
          message: 'Integration provider has no active version.'
        })
      );
    }

    let providerDeployment = integrationProvider.currentVersion.deployment;
    if (
      providerDeployment.provider.type.attributes.backend !== 'slates' ||
      providerDeployment.provider.type.attributes.triggers.status !== 'enabled'
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_not_supported',
          message: 'Callbacks are not supported for the provider of the specified deployment.'
        })
      );
    }

    return { integrationProvider, providerDeployment, solution };
  }

  private async getCallbackRowForUpsertInternal(d: {
    tenant: Tenant;
    environment: Environment;
    integrationProvider: IntegrationProvider;
  }) {
    let solution = await getMetorialSolution();
    let callback = await db.callback.findUnique({
      where: { integrationProviderOid: d.integrationProvider.oid }
    });
    if (!callback) return null;
    if (
      callback.tenantOid !== d.tenant.oid ||
      callback.solutionOid !== solution.oid ||
      callback.environmentOid !== d.environment.oid
    ) {
      return null;
    }
    return callback;
  }

  async getCallbackForIntegrationProvider(
    d: MetorialFacing<GetCallbackForIntegrationProviderParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return await this.getCallbackForIntegrationProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getCallbackForIntegrationProviderInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & GetCallbackForIntegrationProviderParams
  ) {
    let solution = await getMetorialSolution();
    return await db.callback.findFirst({
      where: {
        integrationProviderOid: d.integrationProvider.oid,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        status: 'active'
      },
      include: callbackInclude
    });
  }

  async getCallbackConfigSchemaForIntegrationProvider(
    d: MetorialFacing<GetCallbackConfigSchemaForIntegrationProviderParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return await this.getCallbackConfigSchemaForIntegrationProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getCallbackConfigSchemaForIntegrationProviderInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & GetCallbackConfigSchemaForIntegrationProviderParams
  ) {
    let { integrationProvider, providerDeployment } =
      await this.getIntegrationProviderAndDeployment(d);
    let triggers = d.triggerIds.map(triggerId => ({ triggerId }));
    this.validateTriggerSelection(triggers);
    let resolvedTriggers = await resolveCallbackProviderTriggers({
      environment: d.environment,
      deployment: providerDeployment,
      inputTriggers: triggers
    });

    return await callbackConfigService.getCallbackConfigSchemaInternal({
      tenant: d.tenant,
      integrationProvider,
      providerTriggers: resolvedTriggers.map(trigger => trigger.providerTrigger)
    });
  }

  async upsertCallbackForIntegrationProvider(
    d: MetorialFacing<UpsertCallbackForIntegrationProviderParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    let internal = {
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    };
    let existing = await this.getCallbackRowForUpsertInternal(internal);
    let eventBase = toProviderEventBase(d);
    if (existing) {
      await Fabric.fire('provider.callback.updated:before', eventBase);
    } else {
      await Fabric.fire('provider.callback.created:before', eventBase);
    }
    let callback = await this.upsertCallbackForIntegrationProviderInternal(internal);
    if (existing) {
      await Fabric.fire('provider.callback.updated:after', { ...eventBase, callback });
    } else {
      await Fabric.fire('provider.callback.created:after', { ...eventBase, callback });
    }

    return callback;
  }

  async upsertCallbackForIntegrationProviderInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & UpsertCallbackForIntegrationProviderParams
  ) {
    this.validateTriggerSelection(d.input.triggers);

    let { integrationProvider, providerDeployment, solution } =
      await this.getIntegrationProviderAndDeployment(d);
    let resolvedTriggers = await resolveCallbackProviderTriggers({
      environment: d.environment,
      deployment: providerDeployment,
      inputTriggers: d.input.triggers
    });

    let configSchema = await callbackConfigService.getCallbackConfigSchemaInternal({
      tenant: d.tenant,
      integrationProvider,
      providerTriggers: resolvedTriggers.map(trigger => trigger.providerTrigger)
    });

    let destinationOids: bigint[] | undefined;
    if (d.input.destinationIds !== undefined) {
      let destinationIds = [...new Set(d.input.destinationIds)];
      if (destinationIds.length > MAX_DESTINATIONS_PER_CALLBACK) {
        throw new ServiceError(
          badRequestError({
            code: 'webhook_destination_limit_exceeded',
            message: `A callback can reference at most ${MAX_DESTINATIONS_PER_CALLBACK} webhook destinations.`
          })
        );
      }
      let destinations = await db.callbackDestination.findMany({
        where: {
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          id: { in: destinationIds },
          status: CallbackDestinationStatus.active
        }
      });
      if (destinations.length !== destinationIds.length) {
        throw new ServiceError(
          badRequestError({ message: 'One or more callback destinations were not found.' })
        );
      }
      await Promise.all(
        destinations.map(callbackDestination =>
          callbackDestinationService.ensureMaterializedInternal({
            tenant: d.tenant,
            callbackDestination
          })
        )
      );
      destinationOids = destinations.map(destination => destination.oid);
    }

    let existing = await this.getCallbackRowForUpsertInternal({
      tenant: d.tenant,
      environment: d.environment,
      integrationProvider
    });
    let pollIntervalSecondsOverride =
      d.input.pollIntervalSecondsOverride !== undefined
        ? this.normalizePollInterval(d.input.pollIntervalSecondsOverride)
        : undefined;

    let result = await withTransaction(async tx => {
      let callback = existing
        ? await tx.callback.update({
            where: { oid: existing.oid },
            data: {
              tenantOid: integrationProvider.integration.tenantOid,
              projectOid: integrationProvider.integration.projectOid,
              solutionOid: integrationProvider.integration.solutionOid,
              environmentOid: integrationProvider.integration.environmentOid,
              instanceOid: integrationProvider.integration.instanceOid,
              integrationOid: integrationProvider.integration.oid,
              integrationProviderOid: integrationProvider.oid,
              providerDeploymentOid: providerDeployment.oid,
              status: 'active',
              archivedAt: null,
              name:
                d.input.name ??
                integrationProvider.name ??
                integrationProvider.integration.name,
              description: d.input.description !== undefined ? d.input.description : undefined,
              metadata: d.input.metadata !== undefined ? d.input.metadata : undefined,
              pollIntervalSecondsOverride
            }
          })
        : await tx.callback.create({
            data: {
              ...getId('callback'),
              tenantOid: integrationProvider.integration.tenantOid,
              projectOid: integrationProvider.integration.projectOid,
              solutionOid: integrationProvider.integration.solutionOid,
              environmentOid: integrationProvider.integration.environmentOid,
              instanceOid: integrationProvider.integration.instanceOid,
              integrationOid: integrationProvider.integration.oid,
              integrationProviderOid: integrationProvider.oid,
              providerDeploymentOid: providerDeployment.oid,
              status: 'active',
              name:
                d.input.name ??
                integrationProvider.name ??
                integrationProvider.integration.name,
              description: d.input.description,
              metadata: d.input.metadata,
              pollIntervalSecondsOverride
            }
          });

      let configResult = configSchema.schema
        ? await callbackConfigService.setCallbackConfigInternal({
            tenant: d.tenant,
            callback,
            providerTriggers: resolvedTriggers.map(trigger => trigger.providerTrigger),
            valuesPatch: d.input.configValues ?? {},
            db: tx
          })
        : await callbackConfigService.clearCallbackConfigInternal({
            tenant: d.tenant,
            callback,
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

      if (destinationOids !== undefined || !existing) {
        await tx.callbackDestinationLink.deleteMany({
          where: { callbackOid: callback.oid }
        });
        if (destinationOids?.length) {
          await tx.callbackDestinationLink.createMany({
            data: destinationOids.map(callbackDestinationOid => ({
              oid: snowflake.nextId(),
              callbackOid: callback.oid,
              callbackDestinationOid
            }))
          });
        }
      }

      return {
        callbackId: callback.id,
        supersededCallbackConfigVersionId: configResult.supersededCallbackConfigVersionId
      };
    });

    await callbackRegistrationService.syncCallback({ callbackId: result.callbackId });
    if (result.supersededCallbackConfigVersionId) {
      await callbackConfigBackingDeleteQueue.add({
        callbackConfigVersionId: result.supersededCallbackConfigVersionId
      });
    }

    return await this.getCallbackByIdInternal({
      tenant: d.tenant,
      environment: d.environment,
      callbackId: result.callbackId
    });
  }

  async archiveCallback(d: MetorialFacing<ArchiveCallbackParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.callback.archived:before', eventBase);

    let callback = await this.archiveCallbackInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.callback.archived:after', { ...eventBase, callback });
    return callback;
  }

  async archiveCallbackInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveCallbackParams
  ) {
    let archivedAt = new Date();

    let archived = await withTransaction(async tx => {
      let archived = await tx.callback.update({
        where: { oid: d.callback.oid },
        data: {
          status: 'archived',
          archivedAt
        },
        include: callbackInclude
      });

      await tx.callbackInstance.updateMany({
        where: { callbackOid: d.callback.oid },
        data: { isParentDeleted: true }
      });

      return archived;
    });

    await callbackRegistrationService.syncCallback({ callbackId: archived.id });

    return archived;
  }
}

export let callbackService = Service.create(
  'callbackService',
  () => new callbackServiceImpl()
).build();
