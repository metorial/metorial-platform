import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type CallbackEventSource,
  type CallbackEventStatus,
  db,
  type Environment,
  type Prisma,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveCallbackInstances,
  resolveCallbacks
} from '@metorial-subspace/list-utils';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import type { ProviderWebhookEventRequest } from '@metorial-subspace/provider-utils';
import {
  callbackEventInclude,
  type CallbackEventWithRelations
} from '../lib/callbackIncludes';

export type ListCallbackEventsParams = {
  callbackIds?: string[];
  callbackInstanceIds?: string[];
  status?: CallbackEventStatus[];
  source?: CallbackEventSource[];
  occurredAt?: DateFilter;
  createdAt?: DateFilter;
};

export type GetCallbackEventByIdParams = {
  callbackEventId: string;
};

export type CallbackEventDetails = {
  status: string;
  payload: Record<string, any> | null;
  attemptCount: number;
  error: { code: string; message: string } | null;
  webhook: {
    status: string;
    attemptCount: number;
    request: ProviderWebhookEventRequest | null;
    receivedAt: Date;
  } | null;
};

export type CallbackEventWithDetails = CallbackEventWithRelations & {
  details: CallbackEventDetails | null;
};

class callbackEventServiceImpl {
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
    let solution = await getMetorialSolution();
    let selector = { tenant: d.tenant, environment: d.environment, solution };

    let [callbacks, callbackInstances] = await Promise.all([
      resolveCallbacks(selector, d.callbackIds),
      resolveCallbackInstances(selector, d.callbackInstanceIds)
    ]);

    return Paginator.create<CallbackEventWithRelations>(({ prisma }) =>
      prisma(async opts =>
        db.callbackEvent.findMany({
          ...opts,
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: solution.oid,
            environmentOid: d.environment.oid,
            AND: [
              callbacks ? { callbackOid: callbacks.in } : undefined!,
              callbackInstances ? { callbackInstanceOid: callbackInstances.in } : undefined!,
              d.status?.length ? { status: { in: d.status } } : undefined!,
              d.source?.length ? { source: { in: d.source } } : undefined!,
              d.occurredAt ? { occurredAt: normalizeDateFilter(d.occurredAt) } : undefined!,
              d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
            ].filter(Boolean) as Prisma.CallbackEventWhereInput[]
          },
          include: callbackEventInclude
        })
      )
    );
  }

  async getCallbackEventById(
    d: MetorialFacing<GetCallbackEventByIdParams>
  ): Promise<CallbackEventWithDetails> {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getCallbackEventByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getCallbackEventByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetCallbackEventByIdParams
  ): Promise<CallbackEventWithDetails> {
    let solution = await getMetorialSolution();

    let callbackEvent = await db.callbackEvent.findFirst({
      where: {
        id: d.callbackEventId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid
      },
      include: callbackEventInclude
    });
    if (!callbackEvent) {
      throw new ServiceError(notFoundError('callback_event', d.callbackEventId));
    }

    return {
      ...callbackEvent,
      details: await this.hydrate(d.tenant, callbackEvent)
    };
  }

  private async hydrate(
    tenant: Tenant,
    callbackEvent: CallbackEventWithRelations
  ): Promise<CallbackEventDetails | null> {
    let providerVariant = await db.providerVariant.findUniqueOrThrow({
      where: { oid: callbackEvent.callback.providerVariantOid }
    });

    let backend = await getBackend({ entity: providerVariant });
    if (!backend.callbacks) return null;

    let [{ events }, { webhookEvents }] = await Promise.all([
      backend.callbacks.getManyEvents({ tenant, callbackEvents: [callbackEvent] }),
      backend.callbacks.getManyWebhookEvents({ tenant, callbackEvents: [callbackEvent] })
    ]);

    let event = events[0];
    if (!event) return null;

    let webhookEvent = webhookEvents[0];

    return {
      status: event.status,
      payload: event.payload,
      attemptCount: event.attemptCount,
      error: event.error,
      webhook: webhookEvent
        ? {
            status: webhookEvent.status,
            attemptCount: webhookEvent.attemptCount,
            request: webhookEvent.request,
            receivedAt: webhookEvent.receivedAt
          }
        : null
    };
  }
}

export let callbackEventService = Service.create(
  'callbackEvent',
  () => new callbackEventServiceImpl()
).build();
