import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  CallbackStatus,
  db,
  type Environment,
  type Tenant
} from '@metorial-subspace/db';
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

let toCallbackEvent = (event: Awaited<ReturnType<typeof signal.callback.getEvent>>) => {
  return {
    id: event.id,
    externalId: event.externalId ?? null,
    type: event.type,
    sourceId: event.sourceId ?? event.id,
    triggerKey: event.triggerKey,
    input: event.input,
    output: event.output,
    status: event.status,
    error: event.error,
    deliveryStatus: event.deliveryStatus as 'sent' | 'failed' | 'pending' | 'skipped',
    callbackId: event.callbackId,
    callbackInstanceId: event.callbackInstanceId ?? null,
    providerDeploymentConfigPairId: null,
    createdAt: event.createdAt
  };
};

export type ListCallbackEventsParams = {
  callbackId: string;
  input: {
    limit?: number;
    after?: string;
    before?: string;
    cursor?: string;
    order?: 'asc' | 'desc';
    eventTypes?: string[];
  };
};

export type GetCallbackEventParams = {
  callbackId: string;
  slateTriggerEventId: string;
};

type ListCallbackEventSourceIdsParams = {
  callbackEventIds: string[];
};

class callbackEventServiceImpl {
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
        status: { notIn: [CallbackStatus.deleted] }
      }
    });
    if (!callback) {
      throw new ServiceError(notFoundError('callback', d.callbackId));
    }

    return { callback };
  }

  async listCallbackEvents(d: MetorialFacing<ListCallbackEventsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listCallbackEventsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listCallbackEventsInternal(
    d: { tenant: Tenant; environment: Environment } & ListCallbackEventsParams
  ) {
    let context = await this.resolveContext(d);

    if (!context.callback.isCallbacksV2) return emptyList;

    let signalTenant = await getTenantForSignal(d.tenant);
    let res = await signal.callback.listEvents({
      tenantId: signalTenant.id,
      callbackId: context.callback.id,
      eventTypes: d.input.eventTypes,
      limit: d.input.limit,
      after: d.input.after,
      before: d.input.before,
      cursor: d.input.cursor,
      order: d.input.order
    });

    return {
      object: res.object,
      items: res.items.map(toCallbackEvent),
      pagination: res.pagination
    };
  }

  async getCallbackEvent(d: MetorialFacing<GetCallbackEventParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getCallbackEventInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getCallbackEventInternal(
    d: { tenant: Tenant; environment: Environment } & GetCallbackEventParams
  ) {
    let context = await this.resolveContext(d);
    if (!context.callback.isCallbacksV2) {
      throw new ServiceError(notFoundError('callback.event', d.slateTriggerEventId));
    }

    let signalTenant = await getTenantForSignal(d.tenant);
    let event = await signal.callback.getEvent({
      tenantId: signalTenant.id,
      callbackId: context.callback.id,
      callbackEventId: d.slateTriggerEventId
    });

    return toCallbackEvent(event);
  }

  async listCallbackEventSourceIds(d: MetorialFacing<ListCallbackEventSourceIdsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listCallbackEventSourceIdsInternal({
      ...rest,
      tenant: scope.tenant
    });
  }

  async listCallbackEventSourceIdsInternal(d: {
    tenant: Tenant;
    callbackEventIds: string[];
  }) {
    if (d.callbackEventIds.length === 0) return [];

    let signalTenant = await getTenantForSignal(d.tenant);
    let events = await signal.callback.listEventsByIds({
      tenantId: signalTenant.id,
      callbackEventIds: d.callbackEventIds
    });

    return events.map(event => event.externalId).filter((id): id is string => Boolean(id));
  }
}

export let callbackEventService = Service.create(
  'callbackEventService',
  () => new callbackEventServiceImpl()
).build();
