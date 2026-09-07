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
    // triggerRawEvents are cleaned up once mapping completes, so also check the
    // durable link on triggerEvents to keep visibility working afterwards.
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
    let registrations = d.webhookRegistrationIds
      ? await db.slateWebhookRegistration.findMany({
          where: { tenantOid: d.tenant.oid, id: { in: d.webhookRegistrationIds } },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateWebhookEvent.findMany({
            ...opts,
            where: {
              webhookRegistrationOid: registrations
                ? { in: registrations.map(r => r.oid) }
                : undefined,
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
