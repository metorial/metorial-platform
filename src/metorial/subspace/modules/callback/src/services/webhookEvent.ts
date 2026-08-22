import { isServiceError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { getTenantForSignal, signal } from '../signal';

export type WebhookEventFilters = {
  callbackIds?: string[];
  eventTypes?: string[];
  statuses?: ('pending' | 'delivered' | 'failed')[];
  destinationIds?: string[];
  limit?: number;
  after?: string;
  before?: string;
  cursor?: string;
  order?: 'asc' | 'desc';
};

export type ListWebhookEventsParams = {
  filters: WebhookEventFilters;
};

export type GetWebhookEventParams = {
  webhookEventId: string;
};

class webhookEventServiceImpl {
  async resolveAuthorizedCallbackIdsInternal(d: { tenant: Tenant; environment: Environment }) {
    let solution = await getMetorialSolution();
    let callbacks = await db.callback.findMany({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        status: { in: ['active', 'archived'] }
      },
      select: { id: true }
    });
    return callbacks.map(callback => callback.id);
  }

  async listWebhookEvents(d: MetorialFacing<ListWebhookEventsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return await this.listWebhookEventsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listWebhookEventsInternal(
    d: { tenant: Tenant; environment: Environment } & ListWebhookEventsParams
  ) {
    let signalTenant = await getTenantForSignal(d.tenant);
    return await signal.event.list({
      tenantId: signalTenant.id,
      scopeIds: [d.environment.id],
      callbackIds: d.filters.callbackIds,
      eventTypes: d.filters.eventTypes,
      statuses: d.filters.statuses,
      destinationIds: d.filters.destinationIds,
      limit: d.filters.limit,
      after: d.filters.after,
      before: d.filters.before,
      cursor: d.filters.cursor,
      order: d.filters.order
    });
  }

  async getWebhookEvent(d: MetorialFacing<GetWebhookEventParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return await this.getWebhookEventInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getWebhookEventInternal(
    d: { tenant: Tenant; environment: Environment } & GetWebhookEventParams
  ) {
    let signalTenant = await getTenantForSignal(d.tenant);
    let event: Awaited<ReturnType<typeof signal.event.get>>;
    try {
      event = await signal.event.get({
        tenantId: signalTenant.id,
        eventId: d.webhookEventId
      });
    } catch (error) {
      if (isServiceError(error) && error.data.code === 'not_found') {
        throw new ServiceError(notFoundError('webhook.event', d.webhookEventId));
      }
      throw error;
    }
    if (event.scopeId !== d.environment.id) {
      throw new ServiceError(notFoundError('webhook.event', d.webhookEventId));
    }
    return event;
  }

  async listWebhookEventDeliveriesInternal(
    d: { tenant: Tenant; environment: Environment } & GetWebhookEventParams
  ) {
    await this.getWebhookEventInternal(d);
    let signalTenant = await getTenantForSignal(d.tenant);
    let intents = await signal.eventDeliveryIntent.list({
      tenantId: signalTenant.id,
      eventIds: [d.webhookEventId],
      limit: 100
    });
    let intentIds = intents.items.map(intent => intent.id);
    let attempts: Awaited<ReturnType<typeof signal.eventDeliveryAttempt.list>>['items'] = [];
    let after: string | undefined;
    while (intentIds.length) {
      let page = await signal.eventDeliveryAttempt.list({
        tenantId: signalTenant.id,
        intentIds,
        limit: 100,
        after
      });
      attempts.push(...page.items);
      if (!page.pagination.has_more_after || page.items.length === 0) break;
      after = page.items[page.items.length - 1]!.id;
    }
    let destinationIds = [...new Set(intents.items.map(intent => intent.destination.id))];
    let solution = await getMetorialSolution();
    let destinations = destinationIds.length
      ? await db.callbackDestination.findMany({
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            OR: [
              { id: { in: destinationIds } },
              { signalEventDestinationId: { in: destinationIds } }
            ]
          }
        })
      : [];
    let destinationBySignalId = new Map(
      destinations.flatMap(destination => [
        [destination.id, destination] as const,
        ...(destination.signalEventDestinationId
          ? ([[destination.signalEventDestinationId, destination]] as const)
          : [])
      ])
    );
    let attemptsByIntentId = new Map<string, typeof attempts>();
    for (let attempt of attempts) {
      let items = attemptsByIntentId.get(attempt.intent.id) ?? [];
      items.push(attempt);
      attemptsByIntentId.set(attempt.intent.id, items);
    }

    return intents.items.map(intent => ({
      ...intent,
      destination: destinationBySignalId.get(intent.destination.id) ?? null,
      attempts: (attemptsByIntentId.get(intent.id) ?? []).sort((left, right) =>
        left.attemptNumber === right.attemptNumber
          ? left.createdAt.getTime() - right.createdAt.getTime()
          : left.attemptNumber - right.attemptNumber
      )
    }));
  }

  async listWebhookEventDeliveries(d: MetorialFacing<GetWebhookEventParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return await this.listWebhookEventDeliveriesInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }
}

export let webhookEventService = Service.create(
  'webhookEventService',
  () => new webhookEventServiceImpl()
).build();
