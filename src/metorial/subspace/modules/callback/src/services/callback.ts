import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type Callback,
  CallbackDestinationStatus,
  db,
  type Environment,
  getId,
  type Provider,
  type ProviderDeployment,
  type ProviderType,
  snowflake,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveProviderDeployments
} from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { providerDeploymentInternalService } from '@metorial-subspace/module-provider-internal';
import { Fabric } from '@metorial/fabric';
import { callbackRegistrationService } from './callbackRegistration';

let MAX_DESTINATIONS_PER_CALLBACK = 100;
let MAX_TRIGGERS_PER_CALLBACK = 100;

let callbackInclude = {
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
    include: {
      callbackDestination: true
    }
  }
};

export type ListCallbacksParams = {
  status?: ('active' | 'archived' | 'deleted')[];
  allowDeleted?: boolean;
  ids?: string[];
  providerDeploymentIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetCallbackByIdParams = {
  callbackId: string;
  allowDeleted?: boolean;
};

export type CreateCallbackParams = {
  providerDeployment: {
    id: string;
  };
  input: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
    pollIntervalSecondsOverride?: number | null;
    triggers: { triggerId: string; eventTypes?: string[] }[];
    destinationIds: string[];
  };
};

export type UpdateCallbackParams = {
  callback: Callback & {
    providerDeployment: ProviderDeployment & {
      provider: Provider & {
        type: ProviderType;
      };
      currentVersion: unknown;
    };
  };
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    pollIntervalSecondsOverride?: number | null;
    triggers?: { triggerId: string; eventTypes?: string[] }[];
    destinationIds?: string[];
  };
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

  async listCallbacks(d: MetorialFacing<ListCallbacksParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listCallbacksInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listCallbacksInternal(d: { tenant: Tenant; environment: Environment } & ListCallbacksParams) {
    let solution = await getMetorialSolution();
    let ts = { tenant: d.tenant, environment: d.environment, solution };
    let deployments = await resolveProviderDeployments(ts, d.providerDeploymentIds);

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

  private async getDeploymentAndValidate(d: {
    tenant: Tenant;
    environment: Environment;
    providerDeployment: {
      id: string;
    };
  }) {
    let solution = await getMetorialSolution();

    let providerDeployment = await db.providerDeployment.findFirst({
      where: {
        id: d.providerDeployment.id,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid
      },
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
    });
    if (!providerDeployment) {
      throw new ServiceError(notFoundError('provider.deployment', d.providerDeployment.id));
    }

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

    return providerDeployment;
  }

  private async resolveTriggerDefs(d: {
    environment: Environment;
    deployment: ProviderDeployment;
    inputTriggers: { triggerId: string; eventTypes?: string[] }[];
  }) {
    let deployment = await db.providerDeployment.findFirstOrThrow({
      where: { oid: d.deployment.oid },
      include: {
        provider: {
          include: {
            defaultVariant: {
              include: {
                currentVersion: true
              }
            }
          }
        },
        currentVersion: {
          include: {
            lockedVersion: true
          }
        }
      }
    });

    let version = await providerDeploymentInternalService.getCurrentVersion({
      provider: deployment.provider,
      environment: d.environment,
      deployment
    });
    if (!version?.specificationOid) {
      throw new ServiceError(
        badRequestError({
          code: 'missing_specification',
          message: 'Deployment has no discovered specification with triggers.'
        })
      );
    }

    let providerTriggers = await db.providerTrigger.findMany({
      where: { specificationOid: version.specificationOid, adapterOid: null }
    });

    let byMatcher = new Map<string, (typeof providerTriggers)[number]>();
    for (let trigger of providerTriggers) {
      byMatcher.set(trigger.key, trigger);
      byMatcher.set(trigger.specId, trigger);
      byMatcher.set(trigger.callableId, trigger);
      if (trigger.specUniqueIdentifier) {
        byMatcher.set(trigger.specUniqueIdentifier, trigger);
      }
    }

    return d.inputTriggers.map(item => {
      let trigger = byMatcher.get(item.triggerId);
      if (!trigger) {
        throw new ServiceError(
          badRequestError({
            code: 'invalid_callback_trigger',
            message: `Trigger not found in provider specification: ${item.triggerId}`
          })
        );
      }

      return {
        providerTriggerOid: trigger.oid,
        eventTypes: item.eventTypes?.length ? item.eventTypes : []
      };
    });
  }

  async createCallback(d: MetorialFacing<CreateCallbackParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.callback.created:before', eventBase);

    let callback = await this.createCallbackInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.callback.created:after', { ...eventBase, callback });

    return callback;
  }

  async createCallbackInternal(
    d: { tenant: Tenant; environment: Environment } & CreateCallbackParams
  ) {
    let solution = await getMetorialSolution();

    let providerDeployment = await this.getDeploymentAndValidate({
      tenant: d.tenant,
      environment: d.environment,
      providerDeployment: d.providerDeployment
    });

    if (d.input.triggers.length > MAX_TRIGGERS_PER_CALLBACK) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_trigger_limit_exceeded',
          message: `A callback can reference at most ${MAX_TRIGGERS_PER_CALLBACK} triggers.`
        })
      );
    }

    let providerTriggers = await this.resolveTriggerDefs({
      environment: d.environment,
      deployment: providerDeployment,
      inputTriggers: d.input.triggers
    });
    let destinationIds = [...new Set(d.input.destinationIds)];
    if (destinationIds.length > MAX_DESTINATIONS_PER_CALLBACK) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_destination_limit_exceeded',
          message: `A callback can reference at most ${MAX_DESTINATIONS_PER_CALLBACK} destinations.`
        })
      );
    }
    let pollIntervalSecondsOverride = this.normalizePollInterval(
      d.input.pollIntervalSecondsOverride
    );

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

    let callback = await db.callback.create({
      data: {
        ...getId('callback'),
        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        instanceOid: d.environment.instanceOid,
        providerDeploymentOid: providerDeployment.oid,
        status: 'active',
        mode: 'manual',
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,
        pollIntervalSecondsOverride,
        callbackProviderTriggers: {
          create: providerTriggers.map(trigger => ({
            ...getId('callbackProviderTrigger'),
            providerTriggerOid: trigger.providerTriggerOid,
            eventTypes: trigger.eventTypes
          }))
        },
        callbackDestinationLinks: {
          create: destinations.map(destination => ({
            oid: snowflake.nextId(),
            callbackDestinationOid: destination.oid
          }))
        }
      }
    });

    await callbackRegistrationService.syncCallback({ callbackId: callback.id });

    return await this.getCallbackByIdInternal({
      tenant: d.tenant,
      environment: d.environment,
      callbackId: callback.id
    });
  }

  async updateCallback(d: MetorialFacing<UpdateCallbackParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.updateCallbackInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateCallbackInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateCallbackParams
  ) {
    let solution = await getMetorialSolution();

    let pollIntervalSecondsOverride =
      d.input.pollIntervalSecondsOverride !== undefined
        ? this.normalizePollInterval(d.input.pollIntervalSecondsOverride)
        : undefined;

    let destinationOids: bigint[] | undefined;
    if (d.input.destinationIds) {
      let destinationIds = [...new Set(d.input.destinationIds)];
      if (destinationIds.length > MAX_DESTINATIONS_PER_CALLBACK) {
        throw new ServiceError(
          badRequestError({
            code: 'callback_destination_limit_exceeded',
            message: `A callback can reference at most ${MAX_DESTINATIONS_PER_CALLBACK} destinations.`
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
      destinationOids = destinations.map(dest => dest.oid);
    }

    if (d.input.triggers && d.input.triggers.length > MAX_TRIGGERS_PER_CALLBACK) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_trigger_limit_exceeded',
          message: `A callback can reference at most ${MAX_TRIGGERS_PER_CALLBACK} triggers.`
        })
      );
    }

    let triggerDefs =
      d.input.triggers !== undefined
        ? await this.resolveTriggerDefs({
            environment: d.environment,
            deployment: d.callback.providerDeployment,
            inputTriggers: d.input.triggers
          })
        : undefined;

    await db.$transaction(async tx => {
      await tx.callback.update({
        where: { oid: d.callback.oid },
        data: {
          mode: 'manual',
          name: d.input.name ?? undefined,
          description: d.input.description ?? undefined,
          metadata: d.input.metadata ?? undefined,
          pollIntervalSecondsOverride: pollIntervalSecondsOverride ?? undefined
        }
      });

      if (destinationOids) {
        await tx.callbackDestinationLink.deleteMany({
          where: { callbackOid: d.callback.oid }
        });
        if (destinationOids.length) {
          await tx.callbackDestinationLink.createMany({
            data: destinationOids.map(destinationOid => ({
              oid: snowflake.nextId(),
              callbackOid: d.callback.oid,
              callbackDestinationOid: destinationOid
            }))
          });
        }
      }

      if (triggerDefs) {
        await tx.callbackProviderTrigger.deleteMany({
          where: { callbackOid: d.callback.oid }
        });

        if (triggerDefs.length) {
          await tx.callbackProviderTrigger.createMany({
            data: triggerDefs.map(trigger => ({
              ...getId('callbackProviderTrigger'),
              callbackOid: d.callback.oid,
              providerTriggerOid: trigger.providerTriggerOid,
              eventTypes: trigger.eventTypes
            }))
          });
        }
      }
    });

    await callbackRegistrationService.syncCallback({ callbackId: d.callback.id });

    return await this.getCallbackByIdInternal({
      tenant: d.tenant,
      environment: d.environment,
      callbackId: d.callback.id
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

    let archived = await withTransaction(async db => {
      let archived = await db.callback.update({
        where: { oid: d.callback.oid },
        data: {
          status: 'archived',
          archivedAt
        },
        include: callbackInclude
      });

      await db.callbackInstance.updateMany({
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
