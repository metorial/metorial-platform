import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  CallbackStatus,
  db,
  type Environment,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
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

class callbackEventServiceImpl {
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
        status: { notIn: [CallbackStatus.deleted] }
      }
    });
    if (!callback) {
      throw new ServiceError(notFoundError('callback', d.callbackId));
    }

    return { callback };
  }

  async listCallbackEvents(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    input: {
      limit?: number;
      after?: string;
      before?: string;
      cursor?: string;
      order?: 'asc' | 'desc';
      eventTypes?: string[];
    };
  }) {
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

  async getCallbackEvent(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    slateTriggerEventId: string;
  }) {
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

  async listCallbackEventSourceIds(d: { tenant: Tenant; callbackEventIds: string[] }) {
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
