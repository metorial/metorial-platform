import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma, Tenant } from '../../prisma/generated/client';
import { db } from '../db';

let include = { webhookRegistration: { include: { slate: true, triggerGroup: true } } };

let visibleTo = (tenant: Tenant): Prisma.SlateWebhookEventWhereInput => ({
  OR: [
    { webhookRegistration: { tenantOid: tenant.oid } },
    {
      triggerRawEvents: {
        some: {
          triggerRegistrationInstance: { triggerRegistration: { tenantOid: tenant.oid } }
        }
      }
    },
    {
      triggerEvents: {
        some: {
          triggerRegistrationInstance: { triggerRegistration: { tenantOid: tenant.oid } }
        }
      }
    }
  ]
});

class slateWebhookEventServiceImpl {
  async getSlateWebhookEventById(d: { tenant: Tenant; id: string }) {
    let event = await db.slateWebhookEvent.findFirst({
      where: { id: d.id, ...visibleTo(d.tenant) },
      include
    });
    if (!event) throw new ServiceError(notFoundError('slate.webhook_event'));
    return event;
  }

  async listSlateWebhookEvents(d: { tenant: Tenant; webhookRegistrationIds?: string[] }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateWebhookEvent.findMany({
            ...opts,
            where: {
              webhookRegistration: d.webhookRegistrationIds
                ? { id: { in: d.webhookRegistrationIds } }
                : undefined,

              // Visibility is per-event not per-registration,
              // that also means that above webhook id filter is fine because
              // the user will still only ever see their events
              ...visibleTo(d.tenant)
            },
            include
          })
      )
    );
  }

  async getManySlateWebhookEventsByIds(d: { tenant: Tenant; ids: string[] }) {
    return db.slateWebhookEvent.findMany({
      where: { id: { in: d.ids }, ...visibleTo(d.tenant) },
      include
    });
  }
}

export let slateWebhookEventService = Service.create(
  'slateWebhookEventService',
  () => new slateWebhookEventServiceImpl()
).build();
