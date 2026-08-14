import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { getTenantForSignal, signal } from '../signal';

let emptyList = {
  object: 'list',
  items: [],
  pagination: {
    has_more_after: false,
    has_more_before: false
  }
};

export type ListCallbackDeliveriesParams = {
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
};

export type GetCallbackDeliveryParams = {
  callbackId: string;
  eventDeliveryIntentId: string;
};

export type ListCallbackDeliveryAttemptsParams = {
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
};

export type GetCallbackDeliveryAttemptParams = {
  callbackId: string;
  eventDeliveryAttemptId: string;
};

class callbackDeliveryServiceImpl {
  private async resolveContext(d: {
    tenant: Tenant;
    environment: Environment;
    callbackId: string;
  }) {
    let solution = await getMetorialSolution();

    let callback = await db.callback.findFirst({
      where: {
        id: d.callbackId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
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

    return {
      callback,
      linkedDestinationIds: callback.callbackDestinationLinks
        .map(link => link.callbackDestination.signalEventDestinationId ?? link.callbackDestination.id)
        .filter(Boolean),
      activeDestinationIds: callback.callbackDestinationLinks
        .filter(link => link.callbackDestination.status === 'active')
        .map(link => link.callbackDestination.signalEventDestinationId ?? link.callbackDestination.id)
        .filter(Boolean)
    };
  }

  async listCallbackDeliveries(d: MetorialFacing<ListCallbackDeliveriesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listCallbackDeliveriesInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listCallbackDeliveriesInternal(
    d: { tenant: Tenant; environment: Environment } & ListCallbackDeliveriesParams
  ) {
    let solution = await getMetorialSolution();
    let context = await this.resolveContext(d);
    if (!context.callback.isCallbacksV2) return emptyList;

    let destinationIds = d.input.destinationIds?.length
      ? (
          await db.callbackDestination.findMany({
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              id: { in: d.input.destinationIds }
            },
            select: { id: true, signalEventDestinationId: true }
          })
        )
          .map(item => item.signalEventDestinationId ?? item.id)
          .filter(id => context.activeDestinationIds.includes(id))
      : undefined;

    let signalTenant = await getTenantForSignal(d.tenant);
    return await signal.callback.listDeliveries({
      tenantId: signalTenant.id,
      callbackId: context.callback.id,
      destinationIds,
      status: d.input.status,
      limit: d.input.limit,
      after: d.input.after,
      before: d.input.before,
      cursor: d.input.cursor,
      order: d.input.order
    });
  }

  async getCallbackDelivery(d: MetorialFacing<GetCallbackDeliveryParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getCallbackDeliveryInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getCallbackDeliveryInternal(
    d: { tenant: Tenant; environment: Environment } & GetCallbackDeliveryParams
  ) {
    let context = await this.resolveContext(d);
    if (!context.callback.isCallbacksV2) {
      throw new ServiceError(notFoundError('callback.delivery', d.eventDeliveryIntentId));
    }

    let signalTenant = await getTenantForSignal(d.tenant);
    return await signal.callback.getDelivery({
      tenantId: signalTenant.id,
      callbackId: context.callback.id,
      eventDeliveryIntentId: d.eventDeliveryIntentId
    });
  }

  async listCallbackDeliveryAttempts(d: MetorialFacing<ListCallbackDeliveryAttemptsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listCallbackDeliveryAttemptsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listCallbackDeliveryAttemptsInternal(
    d: { tenant: Tenant; environment: Environment } & ListCallbackDeliveryAttemptsParams
  ) {
    let solution = await getMetorialSolution();
    let context = await this.resolveContext(d);
    if (!context.callback.isCallbacksV2) return emptyList;

    let destinationIds = d.input.destinationIds?.length
      ? (
          await db.callbackDestination.findMany({
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              id: { in: d.input.destinationIds }
            },
            select: { id: true, signalEventDestinationId: true }
          })
        ).map(item => item.signalEventDestinationId ?? item.id)
      : undefined;

    let signalTenant = await getTenantForSignal(d.tenant);
    return await signal.callback.listDeliveryAttempts({
      tenantId: signalTenant.id,
      callbackId: context.callback.id,
      destinationIds,
      status: d.input.status,
      limit: d.input.limit,
      after: d.input.after,
      before: d.input.before,
      cursor: d.input.cursor,
      order: d.input.order
    });
  }

  async getCallbackDeliveryAttempt(d: MetorialFacing<GetCallbackDeliveryAttemptParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getCallbackDeliveryAttemptInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getCallbackDeliveryAttemptInternal(
    d: { tenant: Tenant; environment: Environment } & GetCallbackDeliveryAttemptParams
  ) {
    let context = await this.resolveContext(d);
    if (!context.callback.isCallbacksV2) {
      throw new ServiceError(
        notFoundError('callback.delivery_attempt', d.eventDeliveryAttemptId)
      );
    }

    let signalTenant = await getTenantForSignal(d.tenant);
    return await signal.callback.getDeliveryAttempt({
      tenantId: signalTenant.id,
      callbackId: context.callback.id,
      eventDeliveryAttemptId: d.eventDeliveryAttemptId
    });
  }
}

export let callbackDeliveryService = Service.create(
  'callbackDeliveryService',
  () => new callbackDeliveryServiceImpl()
).build();
