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
import { getTenantForSlates, slates } from '@metorial-subspace/provider-slates/src/client';
import { callbackRegistrationService } from './callbackRegistration';

class callbackDestinationServiceImpl {
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

  async listCallbackDestinations(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.callbackDestination.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            status: { notIn: [CallbackDestinationStatus.deleted] }
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

    let slatesTenant = await getTenantForSlates(d.tenant);
    let slateDestination = await slates.slateTriggerDestination.create({
      tenantId: slatesTenant.id,
      name: d.input.name,
      description: d.input.description,
      url: endpoint.url,
      method: endpoint.method
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
        method: endpoint.method,
        slateTriggerDestinationId: slateDestination.id
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

    let slatesTenant = await getTenantForSlates(d.tenant);
    await slates.slateTriggerDestination.update({
      tenantId: slatesTenant.id,
      slateTriggerDestinationId: destination.slateTriggerDestinationId,
      name: d.input.name,
      description: d.input.description,
      url: endpoint?.url,
      method: endpoint?.method
    });

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

    let callbacks = await db.callbackDestinationLink.findMany({
      where: { callbackDestinationOid: updated.oid },
      select: { callback: { select: { id: true } } }
    });

    await Promise.all(
      callbacks.map(link =>
        callbackRegistrationService.enqueueReconcile({ callbackId: link.callback.id })
      )
    );

    return updated;
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

    let callbacks = await db.callbackDestinationLink.findMany({
      where: { callbackDestinationOid: destination.oid },
      select: { callback: { select: { id: true } } }
    });

    await Promise.all(
      callbacks.map(link =>
        callbackRegistrationService.enqueueReconcile({ callbackId: link.callback.id })
      )
    );

    return archived;
  }
}

export let callbackDestinationService = Service.create(
  'callbackDestinationService',
  () => new callbackDestinationServiceImpl()
).build();
