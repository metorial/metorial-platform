import {
  badRequestError,
  isServiceError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type CallbackDestination,
  CallbackDestinationStatus,
  db,
  type Environment,
  getId,
  type Tenant
} from '@metorial-subspace/db';
import { type DateFilter, normalizeDateFilter } from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { callbackRegistrationService } from './callbackRegistration';
import { getInternalSignal, getTenantForSignal, signal } from '../signal';

type SignalDestination = Awaited<ReturnType<typeof signal.eventDestination.get>>;
type EnrichedCallbackDestination = CallbackDestination & {
  signalDestination?: SignalDestination | null;
};

export type ListCallbackDestinationsParams = {
  callbackIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetCallbackDestinationByIdParams = {
  callbackDestinationId: string;
};

export type CreateCallbackDestinationParams = {
  input: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
    url: string;
    method?: 'POST' | 'PUT' | 'PATCH';
  };
};

export type UpdateCallbackDestinationParams = {
  callbackDestination: CallbackDestination;
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    url?: string;
    method?: 'POST' | 'PUT' | 'PATCH';
  };
};

export type ArchiveCallbackDestinationParams = {
  callbackDestination: CallbackDestination;
};

export type RotateCallbackDestinationSigningSecretParams = {
  callbackDestination: CallbackDestination;
};

type EnrichCallbackDestinationParams = {
  callbackDestination: CallbackDestination;
};

type EnrichCallbackDestinationsParams = {
  callbackDestinations: CallbackDestination[];
};

class callbackDestinationServiceImpl {
  private notMaterializedError() {
    return new ServiceError(
      badRequestError({
        code: 'webhook_destination_not_materialized',
        message: 'The webhook destination has not been materialized in Signal.'
      })
    );
  }

  async enrichCallbackDestination(d: MetorialFacing<EnrichCallbackDestinationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.enrichCallbackDestinationInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async enrichCallbackDestinationInternal(d: {
    tenant: Tenant;
    callbackDestination: CallbackDestination;
  }): Promise<EnrichedCallbackDestination> {
    let eventDestinationId =
      d.callbackDestination.signalEventDestinationId ?? d.callbackDestination.id;

    try {
      let signalTenant = await getTenantForSignal(d.tenant);
      let signalDestination = await signal.eventDestination.get({
        tenantId: signalTenant.id,
        eventDestinationId
      });

      return {
        ...d.callbackDestination,
        signalDestination
      };
    } catch {
      return d.callbackDestination;
    }
  }

  async enrichCallbackDestinations(d: MetorialFacing<EnrichCallbackDestinationsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.enrichCallbackDestinationsInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async enrichCallbackDestinationsInternal(d: {
    tenant: Tenant;
    callbackDestinations: CallbackDestination[];
  }) {
    return await Promise.all(
      d.callbackDestinations.map(callbackDestination =>
        this.enrichCallbackDestinationInternal({ tenant: d.tenant, callbackDestination })
      )
    );
  }

  private normalizeAndValidateEndpoint(d: { url: string; method?: 'POST' | 'PUT' | 'PATCH' }) {
    let parsed: URL;
    try {
      parsed = new URL(d.url);
    } catch {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_webhook_destination_url',
          message: 'Webhook destination URL must be a valid absolute URL.'
        })
      );
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_webhook_destination_url',
          message: 'Webhook destination URL must use http or https.'
        })
      );
    }

    return {
      url: parsed.toString(),
      method: d.method ?? 'POST'
    } as const;
  }

  async listCallbackDestinations(d: MetorialFacing<ListCallbackDestinationsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listCallbackDestinationsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listCallbackDestinationsInternal(
    d: { tenant: Tenant; environment: Environment } & ListCallbackDestinationsParams
  ) {
    let solution = await getMetorialSolution();

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.callbackDestination.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            status: {
              notIn: [CallbackDestinationStatus.archived, CallbackDestinationStatus.deleted]
            },
            AND: [
              d.callbackIds?.length
                ? {
                    callbackDestinationLinks: {
                      some: {
                        callback: {
                          id: { in: d.callbackIds },
                          tenantOid: d.tenant.oid,
                          solutionOid: solution.oid
                        }
                      }
                    }
                  }
                : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
              d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
            ].filter(Boolean)
          }
        })
      )
    );
  }

  async getCallbackDestinationById(d: MetorialFacing<GetCallbackDestinationByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getCallbackDestinationByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getCallbackDestinationByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetCallbackDestinationByIdParams
  ) {
    let solution = await getMetorialSolution();

    let callbackDestination = await db.callbackDestination.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        id: d.callbackDestinationId,
        status: {
          notIn: [CallbackDestinationStatus.archived, CallbackDestinationStatus.deleted]
        }
      }
    });
    if (!callbackDestination) {
      throw new ServiceError(notFoundError('webhook.destination', d.callbackDestinationId));
    }

    return callbackDestination;
  }

  async createCallbackDestination(d: MetorialFacing<CreateCallbackDestinationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.callback_destination.created:before', eventBase);

    let callbackDestination = await this.createCallbackDestinationInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.callback_destination.created:after', {
      ...eventBase,
      callbackDestination
    });

    return callbackDestination;
  }

  async createCallbackDestinationInternal(
    d: { tenant: Tenant; environment: Environment } & CreateCallbackDestinationParams
  ) {
    let solution = await getMetorialSolution();

    let endpoint = this.normalizeAndValidateEndpoint({
      url: d.input.url,
      method: d.input.method
    });

    let callbackDestination = await db.callbackDestination.create({
      data: {
        ...getId('callbackDestination'),
        tenantOid: d.tenant.oid,
        projectOid: d.tenant.projectOid,
        solutionOid: solution.oid,
        status: CallbackDestinationStatus.active,
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,
        url: endpoint.url,
        method: endpoint.method
      }
    });

    return await this.ensureMaterializedInternal({
      tenant: d.tenant,
      callbackDestination
    });
  }

  async updateCallbackDestination(d: MetorialFacing<UpdateCallbackDestinationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.updateCallbackDestinationInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateCallbackDestinationInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateCallbackDestinationParams
  ) {
    let destination = d.callbackDestination;

    let endpoint =
      d.input.url !== undefined || d.input.method !== undefined
        ? this.normalizeAndValidateEndpoint({
            url: d.input.url ?? destination.url,
            method: d.input.method ?? (destination.method as 'POST' | 'PUT' | 'PATCH')
          })
        : null;

    let updated = await db.callbackDestination.update({
      where: { oid: destination.oid },
      data: {
        name: d.input.name ?? destination.name,
        description: d.input.description ?? destination.description,
        metadata: d.input.metadata ?? destination.metadata,
        url: endpoint?.url ?? destination.url,
        method: endpoint?.method ?? destination.method
      }
    });

    updated = await this.ensureMaterializedInternal({
      tenant: d.tenant,
      callbackDestination: updated
    });

    let callbacks = await db.callbackDestinationLink.findMany({
      where: { callbackDestinationOid: updated.oid },
      select: { callback: { select: { id: true } } }
    });
    await Promise.all(
      callbacks.map(link =>
        callbackRegistrationService.syncCallback({ callbackId: link.callback.id })
      )
    );

    return await db.callbackDestination.findFirstOrThrow({
      where: { oid: updated.oid }
    });
  }

  async archiveCallbackDestination(d: MetorialFacing<ArchiveCallbackDestinationParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    let eventBase = toProviderEventBase(d);
    await Fabric.fire('provider.callback_destination.archived:before', eventBase);

    let callbackDestination = await this.archiveCallbackDestinationInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });

    await Fabric.fire('provider.callback_destination.archived:after', {
      ...eventBase,
      callbackDestination
    });

    return callbackDestination;
  }

  async archiveCallbackDestinationInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveCallbackDestinationParams
  ) {
    let destination = d.callbackDestination;

    let signalTenant = await getTenantForSignal(d.tenant);
    try {
      await signal.eventDestination.delete({
        tenantId: signalTenant.id,
        eventDestinationId: destination.signalEventDestinationId ?? destination.id
      });
    } catch (error) {
      if (!isServiceError(error) || error.data.code !== 'not_found') throw error;
    }

    let archived = await db.callbackDestination.update({
      where: { oid: destination.oid },
      data: {
        status: CallbackDestinationStatus.archived
      }
    });

    let callbacks = await db.callbackDestinationLink.findMany({
      where: { callbackDestinationOid: destination.oid },
      select: { callback: { select: { id: true } } }
    });

    await Promise.all(
      callbacks.map(link =>
        callbackRegistrationService.syncCallback({ callbackId: link.callback.id })
      )
    );

    return await db.callbackDestination.findFirstOrThrow({
      where: { oid: archived.oid }
    });
  }

  async rotateSigningSecret(d: MetorialFacing<RotateCallbackDestinationSigningSecretParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return await this.rotateSigningSecretInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async rotateSigningSecretInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & RotateCallbackDestinationSigningSecretParams
  ) {
    let destination = await this.getCallbackDestinationByIdInternal({
      tenant: d.tenant,
      environment: d.environment,
      callbackDestinationId: d.callbackDestination.id
    });

    try {
      destination = await this.ensureMaterializedInternal({
        tenant: d.tenant,
        callbackDestination: destination
      });
    } catch {
      throw this.notMaterializedError();
    }

    if (!destination.signalEventDestinationId) {
      throw this.notMaterializedError();
    }

    let signalTenant = await getTenantForSignal(d.tenant);
    let rotated = await getInternalSignal().eventDestination.rotateSigningSecret({
      tenantId: signalTenant.id,
      eventDestinationId: destination.signalEventDestinationId
    });

    return {
      webhookDestinationId: destination.id,
      signingSecret: rotated.signingSecret,
      rotatedAt: rotated.rotatedAt
    };
  }

  async ensureMaterializedInternal(d: {
    tenant: Tenant;
    callbackDestination: CallbackDestination;
  }) {
    let signalTenant = await getTenantForSignal(d.tenant);
    let materialized = await signal.eventDestination.upsertByExternalId({
      tenantId: signalTenant.id,
      externalId: d.callbackDestination.id,
      name: d.callbackDestination.name,
      description: d.callbackDestination.description,
      variant: {
        type: 'http_endpoint',
        url: d.callbackDestination.url,
        method: d.callbackDestination.method as 'POST' | 'PUT' | 'PATCH'
      }
    });

    return await db.callbackDestination.update({
      where: { oid: d.callbackDestination.oid },
      data: {
        signalEventDestinationId: materialized.id,
        lastSignalSyncedAt: new Date()
      }
    });
  }
}

export let callbackDestinationService = Service.create(
  'callbackDestinationService',
  () => new callbackDestinationServiceImpl()
).build();
