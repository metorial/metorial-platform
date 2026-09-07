import { internalServerError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Environment, type Tenant } from '@metorial-subspace/db';
import { type MetorialFacing, resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import type {
  IProviderCallbacks,
  ProviderWebhookEvent
} from '@metorial-subspace/provider-utils';
import {
  webhookRegistrationInclude,
  type WebhookRegistrationWithRelations
} from '../lib/webhookRegistrationIncludes';
import { webhookRegistrationService } from './webhookRegistration';

export type WebhookEvent = ProviderWebhookEvent & {
  webhookRegistration: WebhookRegistrationWithRelations | null;
};

export type ListWebhookEventsParams = {
  webhookRegistrationIds?: string[];
};

export type GetWebhookEventParams = {
  webhookEventId: string;
};

class webhookEventServiceImpl {
  private async getWebhookEventsBackend(): Promise<IProviderCallbacks | null> {
    let backends = await webhookRegistrationService.getCallbacksBackends();
    if (backends.length === 0) return null;

    if (backends.length > 1) {
      throw new ServiceError(
        internalServerError({
          message: 'Webhook events cannot be read across multiple provider backends.'
        })
      );
    }

    return backends[0]!;
  }

  private async resolveRegistrationFilter(
    d: { tenant: Tenant; environment: Environment } & ListWebhookEventsParams
  ) {
    if (!d.webhookRegistrationIds?.length) return undefined;

    return await Promise.all(
      d.webhookRegistrationIds.map(
        async webhookRegistrationId =>
          await webhookRegistrationService.getWebhookRegistrationByIdInternal({
            tenant: d.tenant,
            environment: d.environment,
            webhookRegistrationId,
            allowDeleted: true
          })
      )
    );
  }

  private async hydrate(events: ProviderWebhookEvent[]): Promise<WebhookEvent[]> {
    let registrationOids = [
      ...new Set(
        events.flatMap(e => (e.webhookRegistrationOid ? [e.webhookRegistrationOid] : []))
      )
    ];

    let registrations = registrationOids.length
      ? await db.webhookRegistration.findMany({
          where: { oid: { in: registrationOids } },
          include: webhookRegistrationInclude
        })
      : [];

    let registrationsByOid = new Map(registrations.map(r => [r.oid, r]));

    return events.map(event => ({
      ...event,
      webhookRegistration:
        (event.webhookRegistrationOid
          ? registrationsByOid.get(event.webhookRegistrationOid)
          : null) ?? null
    }));
  }

  async listWebhookEvents(d: MetorialFacing<ListWebhookEventsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listWebhookEventsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listWebhookEventsInternal(
    d: { tenant: Tenant; environment: Environment } & ListWebhookEventsParams
  ) {
    let backend = await this.getWebhookEventsBackend();
    let webhookRegistrations = await this.resolveRegistrationFilter(d);

    return Paginator.create<WebhookEvent>(() => async input => {
      if (!backend) {
        return { items: [], pagination: { hasNextPage: false, hasPreviousPage: false } };
      }

      let res = await backend.listWebhookEvents({
        tenant: d.tenant,
        webhookRegistrations,
        input
      });

      return {
        items: await this.hydrate(res.items),
        pagination: {
          hasNextPage: res.hasMoreAfter,
          hasPreviousPage: res.hasMoreBefore
        }
      };
    });
  }

  async getWebhookEvent(d: MetorialFacing<GetWebhookEventParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getWebhookEventInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getWebhookEventInternal(
    d: { tenant: Tenant; environment: Environment } & GetWebhookEventParams
  ): Promise<WebhookEvent> {
    let backend = await this.getWebhookEventsBackend();
    if (!backend) {
      throw new ServiceError(notFoundError('webhook_event', d.webhookEventId));
    }

    let event = await backend.getWebhookEvent({
      tenant: d.tenant,
      webhookEventId: d.webhookEventId
    });

    return (await this.hydrate([event]))[0]!;
  }
}

export let webhookEventService = Service.create(
  'webhookEvent',
  () => new webhookEventServiceImpl()
).build();
