import { db, ID } from '@metorial/db';
import type { PresenterContext } from '@metorial/presenter';
import { createQueue } from '@metorial/queue';
import { webhookEvents } from '@metorial/webhook-event-schema';

let eventPresenterContext: PresenterContext = {
  apiVersion: 'mt_2026_01_01_magnetar',
  accessType: 'event_system'
};

export interface SystemEventIngestJob {
  id: string;
  source: 'resource';
  eventType: string;
  organizationId: string;
  instanceId: string | null;
  payload: Record<string, any>;
}

export let systemEventIngestQueue = createQueue<SystemEventIngestJob>({
  name: 'auditing/event/ingest'
});

export let enqueueSystemEvent = async (d: {
  eventType: string;
  organizationId: string;
  instanceId?: string | null;
  payload: Record<string, any>;
}) => {
  let id = await ID.generateId('systemEvent');

  await systemEventIngestQueue.add(
    {
      id,
      source: 'resource',
      eventType: d.eventType,
      organizationId: d.organizationId,
      instanceId: d.instanceId ?? null,
      payload: d.payload
    },
    { id }
  );
};

export let systemEventIngestQueueProcessor = systemEventIngestQueue.process(async data => {
  let definition = (webhookEvents as any)[data.eventType];
  if (!definition) return;

  let [organization, instance] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: data.organizationId },
      select: { oid: true }
    }),
    data.instanceId
      ? db.instance.findUniqueOrThrow({
          where: { id: data.instanceId },
          select: { oid: true }
        })
      : Promise.resolve(null)
  ]);

  let presentedPayload = await definition.presenter
    .present(data.payload)(eventPresenterContext)
    .run();

  await db.systemEvent.upsert({
    where: { id: data.id },
    create: {
      id: data.id,
      source: 'resource',
      eventType: data.eventType,
      organizationOid: organization.oid,
      instanceOid: instance?.oid ?? null,
      payloadJson: presentedPayload
    },
    update: {}
  });
});
