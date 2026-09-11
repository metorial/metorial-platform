import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';

let invocationInclude = {
  invocation: {
    include: {
      slateInvocationAttachment: {
        include: {
          attachments: true
        }
      }
    }
  }
} as const;

class triggerEventInvocationServiceImpl {
  async getManyTriggerEventInvocationsByTriggerEventIds(d: {
    tenant: Tenant;
    triggerEventIds: string[];
  }) {
    if (d.triggerEventIds.length === 0) return [];

    let triggerEvents = await db.triggerEvent.findMany({
      where: {
        id: { in: d.triggerEventIds },
        triggerRegistrationInstance: { triggerRegistration: { tenantOid: d.tenant.oid } }
      },
      select: { oid: true, id: true, webhookEventOid: true }
    });
    if (triggerEvents.length === 0) return [];

    let triggerEventIdByOid = new Map(triggerEvents.map(e => [e.oid, e.id]));

    let triggerEventIdsByWebhookEventOid = new Map<bigint, string[]>();
    for (let event of triggerEvents) {
      if (!event.webhookEventOid) continue;

      let ids = triggerEventIdsByWebhookEventOid.get(event.webhookEventOid) ?? [];
      ids.push(event.id);
      triggerEventIdsByWebhookEventOid.set(event.webhookEventOid, ids);
    }

    let webhookEventOids = [...triggerEventIdsByWebhookEventOid.keys()];

    let [mapInvocations, webhookInvocations] = await Promise.all([
      db.triggerEventInvocation.findMany({
        where: { triggerEventOid: { in: triggerEvents.map(e => e.oid) } },
        include: invocationInclude,
        orderBy: { oid: 'asc' }
      }),
      webhookEventOids.length
        ? db.slateWebhookEventInvocation.findMany({
            where: { webhookEventOid: { in: webhookEventOids } },
            include: { ...invocationInclude, webhookEvent: { select: { id: true } } },
            orderBy: { oid: 'asc' }
          })
        : []
    ]);

    return [
      ...mapInvocations.map(i => ({
        type: 'map_event' as const,
        id: i.id,
        status: i.status,
        attempt: i.attempt,
        errorCode: i.errorCode,
        errorMessage: i.errorMessage,
        triggerEventIds: [triggerEventIdByOid.get(i.triggerEventOid)!],
        webhookEventId: null,
        invocation: i.invocation,
        createdAt: i.createdAt
      })),
      ...webhookInvocations.map(i => ({
        type: 'webhook_handle' as const,
        id: i.id,
        status: i.status,
        attempt: i.attempt,
        errorCode: i.errorCode,
        errorMessage: i.errorMessage,
        triggerEventIds: triggerEventIdsByWebhookEventOid.get(i.webhookEventOid) ?? [],
        webhookEventId: i.webhookEvent.id,
        invocation: i.invocation,
        createdAt: i.createdAt
      }))
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}

export let triggerEventInvocationService = Service.create(
  'triggerEventInvocationService',
  () => new triggerEventInvocationServiceImpl()
).build();
