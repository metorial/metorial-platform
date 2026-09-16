import { Service } from '@lowerdeck/service';
import { db, ID } from '@metorial/db';
import { dispatchSystemEventDelivery } from '@metorial/module-event-delivery';

class EventTrackerServiceImpl {
  async recordCallbackEvent(d: {
    organizationOid: bigint;
    instanceOid: bigint;
    callbackEventId: string;
    callbackId: string;
    callbackTriggerKey?: string | null;
  }) {
    let systemEvent = await db.systemEvent.upsert({
      where: { callbackEventId: d.callbackEventId },
      create: {
        id: await ID.generateId('systemEvent'),
        source: 'callback',
        eventType: `callback.${d.callbackTriggerKey ?? 'unknown'}`,
        organizationOid: d.organizationOid,
        instanceOid: d.instanceOid,
        callbackEventId: d.callbackEventId,
        callbackId: d.callbackId,
        callbackTriggerKey: d.callbackTriggerKey ?? null
      },
      update: {},
      select: { id: true }
    });

    await dispatchSystemEventDelivery({ systemEventId: systemEvent.id });
  }

  async recordChatEvent(d: {
    organizationOid: bigint;
    instanceOid: bigint;
    chatEventId: string;
    chatIntegrationId: string;
    eventType: string;
  }) {
    let systemEvent = await db.systemEvent.upsert({
      where: { chatEventId: d.chatEventId },
      create: {
        id: await ID.generateId('systemEvent'),
        source: 'chat',
        eventType: d.eventType,
        organizationOid: d.organizationOid,
        instanceOid: d.instanceOid,
        chatEventId: d.chatEventId,
        chatIntegrationId: d.chatIntegrationId
      },
      update: {},
      select: { id: true }
    });

    await dispatchSystemEventDelivery({ systemEventId: systemEvent.id });
  }
}

export let eventTrackerService = Service.create(
  'eventTrackerService',
  () => new EventTrackerServiceImpl()
).build();
