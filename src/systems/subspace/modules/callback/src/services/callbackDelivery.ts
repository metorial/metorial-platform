import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Solution, type Tenant } from '@metorial-subspace/db';
import { getTenantForSlates, slates } from '@metorial-subspace/provider-slates/src/client';

class callbackDeliveryServiceImpl {
  private async resolveContext(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
  }) {
    let callback = await db.callback.findFirst({
      where: {
        id: d.callbackId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        status: { notIn: ['deleted'] }
      },
      include: {
        callbackDestinationLinks: {
          include: {
            callbackDestination: true
          }
        }
      }
    });
    if (!callback) throw new ServiceError(notFoundError('callback', d.callbackId));

    let registrations = await db.callbackReceiverRegistration.findMany({
      where: {
        callbackOid: callback.oid,
        status: 'active'
      }
    });

    let slatesTenant = await getTenantForSlates(d.tenant);

    return {
      callback,
      registrations,
      slatesTenant,
      slatesDestinationIds: callback.callbackDestinationLinks
        .filter(link => link.callbackDestination.status === 'active')
        .map(link => link.callbackDestination.slateTriggerDestinationId)
        .filter(Boolean)
    };
  }

  async listCallbackDeliveries(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    input: {
      status?: ('pending' | 'delivered' | 'failed' | 'retrying')[];
      destinationIds?: string[];
      limit?: number;
      after?: string;
      before?: string;
      cursor?: string;
      order?: 'asc' | 'desc';
    };
  }) {
    let context = await this.resolveContext(d);

    let receiverIds = context.registrations
      .map(reg => reg.slateTriggerReceiverId)
      .filter(Boolean);
    let destinationIds = d.input.destinationIds?.length
      ? (
          await db.callbackDestination.findMany({
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              id: { in: d.input.destinationIds }
            },
            select: { slateTriggerDestinationId: true }
          })
        )
          .map(item => item.slateTriggerDestinationId)
          .filter(id => context.slatesDestinationIds.includes(id))
      : undefined;

    return await slates.slateTriggerDelivery.list({
      tenantId: context.slatesTenant.id,
      triggerReceiverIds: receiverIds.length ? receiverIds : ['__none__'],
      destinationIds,
      status: d.input.status,
      limit: d.input.limit,
      after: d.input.after,
      before: d.input.before,
      cursor: d.input.cursor,
      order: d.input.order
    });
  }

  async getCallbackDelivery(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    eventDeliveryIntentId: string;
  }) {
    let context = await this.resolveContext(d);
    let delivery = await slates.slateTriggerDelivery.get({
      tenantId: context.slatesTenant.id,
      eventDeliveryIntentId: d.eventDeliveryIntentId
    });

    if (!context.slatesDestinationIds.includes(delivery.destination.id)) {
      throw new ServiceError(notFoundError('callback.delivery', d.eventDeliveryIntentId));
    }

    return delivery;
  }

  async listCallbackDeliveryAttempts(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    input: {
      status?: ('failed' | 'succeeded')[];
      destinationIds?: string[];
      limit?: number;
      after?: string;
      before?: string;
      cursor?: string;
      order?: 'asc' | 'desc';
    };
  }) {
    let context = await this.resolveContext(d);

    let receiverIds = context.registrations
      .map(reg => reg.slateTriggerReceiverId)
      .filter(Boolean);
    let destinationIds = d.input.destinationIds?.length
      ? (
          await db.callbackDestination.findMany({
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              id: { in: d.input.destinationIds }
            },
            select: { slateTriggerDestinationId: true }
          })
        ).map(item => item.slateTriggerDestinationId)
      : undefined;

    return await slates.slateTriggerDelivery.listAttempts({
      tenantId: context.slatesTenant.id,
      triggerReceiverIds: receiverIds.length ? receiverIds : ['__none__'],
      destinationIds,
      status: d.input.status,
      limit: d.input.limit,
      after: d.input.after,
      before: d.input.before,
      cursor: d.input.cursor,
      order: d.input.order
    });
  }

  async getCallbackDeliveryAttempt(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    eventDeliveryAttemptId: string;
  }) {
    let context = await this.resolveContext(d);
    let attempt = await slates.slateTriggerDelivery.getAttempt({
      tenantId: context.slatesTenant.id,
      eventDeliveryAttemptId: d.eventDeliveryAttemptId
    });

    if (!context.slatesDestinationIds.includes(attempt.intent.destination.id)) {
      throw new ServiceError(
        notFoundError('callback.delivery_attempt', d.eventDeliveryAttemptId)
      );
    }

    return attempt;
  }
}

export let callbackDeliveryService = Service.create(
  'callbackDeliveryService',
  () => new callbackDeliveryServiceImpl()
).build();
