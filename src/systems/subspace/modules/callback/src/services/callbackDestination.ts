import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type CallbackDestination,
  CallbackDestinationStatus,
  db,
  getId,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { type DateFilter, normalizeDateFilter } from '@metorial-subspace/list-utils';
import { callbackRegistrationService } from './callbackRegistration';
import { getTenantForSignal, signal } from '../signal';
import { syncSignalCallback } from '../reconciler/lib/sync';

type SignalDestination = Awaited<ReturnType<typeof signal.eventDestination.get>>;
type EnrichedCallbackDestination = CallbackDestination & {
  signalDestination?: SignalDestination | null;
};

class callbackDestinationServiceImpl {
  private async syncLinkedCallbacksToSignal(d: {
    tenant: Tenant;
    callbackDestination: CallbackDestination;
  }) {
    let callbacks = await db.callbackDestinationLink.findMany({
      where: { callbackDestinationOid: d.callbackDestination.oid },
      select: { callback: { select: { id: true } } }
    });

    await Promise.all(
      callbacks.map(async link => {
        await syncSignalCallback({ callbackId: link.callback.id });
      })
    );
  }

  async enrichCallbackDestination(d: {
    tenant: Tenant;
    callbackDestination: CallbackDestination;
  }): Promise<EnrichedCallbackDestination> {
    if (!d.callbackDestination.signalEventDestinationId) return d.callbackDestination;

    try {
      let signalTenant = await getTenantForSignal(d.tenant);
      let signalDestination = await signal.eventDestination.get({
        tenantId: signalTenant.id,
        eventDestinationId: d.callbackDestination.signalEventDestinationId
      });

      return {
        ...d.callbackDestination,
        signalDestination
      };
    } catch {
      return d.callbackDestination;
    }
  }

  async enrichCallbackDestinations(d: {
    tenant: Tenant;
    callbackDestinations: CallbackDestination[];
  }) {
    return await Promise.all(
      d.callbackDestinations.map(callbackDestination =>
        this.enrichCallbackDestination({ tenant: d.tenant, callbackDestination })
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
          code: 'invalid_callback_destination_url',
          message: 'Callback destination URL must be a valid absolute URL.'
        })
      );
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_callback_destination_url',
          message: 'Callback destination URL must use http or https.'
        })
      );
    }

    return {
      url: parsed.toString(),
      method: d.method ?? 'POST'
    } as const;
  }

  async listCallbackDestinations(d: {
    tenant: Tenant;
    solution: Solution;
    callbackIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.callbackDestination.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            status: { notIn: [CallbackDestinationStatus.deleted] },
            AND: [
              d.callbackIds?.length
                ? {
                    callbackDestinationLinks: {
                      some: {
                        callback: {
                          id: { in: d.callbackIds },
                          tenantOid: d.tenant.oid,
                          solutionOid: d.solution.oid
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

  async getCallbackDestinationById(d: {
    tenant: Tenant;
    solution: Solution;
    callbackDestinationId: string;
  }) {
    let callbackDestination = await db.callbackDestination.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        id: d.callbackDestinationId,
        status: { notIn: [CallbackDestinationStatus.deleted] }
      }
    });
    if (!callbackDestination) {
      throw new ServiceError(notFoundError('callback.destination', d.callbackDestinationId));
    }

    return callbackDestination;
  }

  async createCallbackDestination(d: {
    tenant: Tenant;
    solution: Solution;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, any>;
      url: string;
    };
  }) {
    let endpoint = this.normalizeAndValidateEndpoint({
      url: d.input.url,
      method: 'POST'
    });

    return await db.callbackDestination.create({
      data: {
        ...getId('callbackDestination'),
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        status: CallbackDestinationStatus.active,
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,
        url: endpoint.url,
        method: endpoint.method
      }
    });
  }

  async updateCallbackDestination(d: {
    tenant: Tenant;
    solution: Solution;
    callbackDestination: CallbackDestination;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      url?: string;
    };
  }) {
    let destination = d.callbackDestination;

    let endpoint = d.input.url
      ? this.normalizeAndValidateEndpoint({
          url: d.input.url ?? destination.url,
          method: destination.method as 'POST' | 'PUT' | 'PATCH'
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

    await this.syncLinkedCallbacksToSignal({
      tenant: d.tenant,
      callbackDestination: updated
    });

    let callbacks = await db.callbackDestinationLink.findMany({
      where: { callbackDestinationOid: updated.oid },
      select: { callback: { select: { id: true } } }
    });
    await Promise.all(
      callbacks.map(link =>
        callbackRegistrationService.enqueueReconcile({ callbackId: link.callback.id })
      )
    );

    return await db.callbackDestination.findFirstOrThrow({
      where: { oid: updated.oid }
    });
  }

  async archiveCallbackDestination(d: {
    tenant: Tenant;
    solution: Solution;
    callbackDestination: CallbackDestination;
  }) {
    let destination = d.callbackDestination;

    let archived = await db.callbackDestination.update({
      where: { oid: destination.oid },
      data: {
        status: CallbackDestinationStatus.archived
      }
    });

    await this.syncLinkedCallbacksToSignal({
      tenant: d.tenant,
      callbackDestination: archived
    });

    let callbacks = await db.callbackDestinationLink.findMany({
      where: { callbackDestinationOid: destination.oid },
      select: { callback: { select: { id: true } } }
    });

    await Promise.all(
      callbacks.map(link =>
        callbackRegistrationService.enqueueReconcile({ callbackId: link.callback.id })
      )
    );

    return await db.callbackDestination.findFirstOrThrow({
      where: { oid: archived.oid }
    });
  }
}

export let callbackDestinationService = Service.create(
  'callbackDestinationService',
  () => new callbackDestinationServiceImpl()
).build();
