import { db as integrationsDb } from '@metorial-subspace/db';
import { createCron } from '@metorial/cron';
import { db as metorialDb } from '@metorial/db';
import { purgeEventDeliveriesForSystemEvent } from '@metorial/module-event-delivery';
import { combineQueueProcessors, createQueue, hourlyPacedDelay } from '@metorial/queue';
import { getChatEventPayloadsBucketName, getEventPayloadsBucketName } from '../storage';
import { auditingObjectDelete } from './objectDelete';

export let SYSTEM_EVENT_RETENTION_DAYS = 14;

let batchSize = 500;

type SystemEventCleanupResource = 'systemEvent' | 'callbackEvent' | 'chatEvent';

let getRetentionCutoff = () =>
  new Date(Date.now() - SYSTEM_EVENT_RETENTION_DAYS * 24 * 60 * 60_000);

export let systemEventCleanupManyQueue = createQueue<{
  resource: SystemEventCleanupResource;
  dueBefore: string;
  cursor?: string;
}>({
  name: 'auditing/systemEvent/cleanup/many',
  workerOpts: { concurrency: 1 }
});

export let systemEventCleanupSingleQueue = createQueue<{
  resource: SystemEventCleanupResource;
  eventId: string;
  dueBefore: string;
}>({
  name: 'auditing/systemEvent/cleanup/single',
  workerOpts: { concurrency: 5, limiter: { max: 20, duration: 1000 } }
});

export let systemEventCleanupManyProcessor = systemEventCleanupManyQueue.process(
  async data => {
    let dueBefore = new Date(data.dueBefore);
    let events: { id: string }[];

    if (data.resource === 'systemEvent') {
      events = await metorialDb.systemEvent.findMany({
        where: {
          createdAt: { lt: dueBefore },
          id: data.cursor ? { gt: data.cursor } : undefined
        },
        orderBy: { id: 'asc' },
        select: { id: true },
        take: batchSize
      });
    } else if (data.resource === 'callbackEvent') {
      events = await integrationsDb.callbackEvent.findMany({
        where: {
          createdAt: { lt: dueBefore },
          id: data.cursor ? { gt: data.cursor } : undefined,
          chatEvents: { every: { createdAt: { lt: dueBefore } } }
        },
        orderBy: { id: 'asc' },
        select: { id: true },
        take: batchSize
      });
    } else {
      events = await integrationsDb.chatEvent.findMany({
        where: {
          createdAt: { lt: dueBefore },
          id: data.cursor ? { gt: data.cursor } : undefined
        },
        orderBy: { id: 'asc' },
        select: { id: true },
        take: batchSize
      });
    }

    if (events.length === 0) return;

    await systemEventCleanupSingleQueue.addManyWithOps(
      events.map(event => ({
        data: { resource: data.resource, eventId: event.id, dueBefore: data.dueBefore },
        opts: { id: `system-event-cleanup:${data.resource}:${event.id}` }
      }))
    );

    if (events.length === batchSize) {
      await systemEventCleanupManyQueue.add(
        {
          resource: data.resource,
          dueBefore: data.dueBefore,
          cursor: events[events.length - 1]!.id
        },
        hourlyPacedDelay()
      );
    }
  }
);

export let systemEventCleanupSingleProcessor = systemEventCleanupSingleQueue.process(
  async data => {
    let dueBefore = new Date(data.dueBefore);

    if (data.resource === 'systemEvent') {
      let event = await metorialDb.systemEvent.findFirst({
        where: { id: data.eventId, createdAt: { lt: dueBefore } },
        select: { oid: true, id: true, payloadStorageKey: true }
      });
      if (!event) return;

      await purgeEventDeliveriesForSystemEvent({ systemEventOid: event.oid });

      await metorialDb.systemEvent.delete({ where: { id: event.id } });

      if (event.payloadStorageKey) {
        await auditingObjectDelete.enqueue(getEventPayloadsBucketName(), [
          event.payloadStorageKey
        ]);
      }
      return;
    }

    if (data.resource === 'chatEvent') {
      let event = await integrationsDb.chatEvent.findFirst({
        where: { id: data.eventId, createdAt: { lt: dueBefore } },
        select: { id: true, payloadStorageKey: true }
      });
      if (!event) return;

      await integrationsDb.chatEvent.delete({ where: { id: event.id } });

      if (event.payloadStorageKey) {
        await auditingObjectDelete.enqueue(getChatEventPayloadsBucketName(), [
          event.payloadStorageKey
        ]);
      }
      return;
    }

    let event = await integrationsDb.callbackEvent.findFirst({
      where: {
        id: data.eventId,
        createdAt: { lt: dueBefore },
        chatEvents: { every: { createdAt: { lt: dueBefore } } }
      },
      select: {
        id: true,
        chatEvents: { select: { payloadStorageKey: true } }
      }
    });
    if (!event) return;

    let payloadKeys = event.chatEvents.flatMap(chatEvent =>
      chatEvent.payloadStorageKey ? [chatEvent.payloadStorageKey] : []
    );

    await integrationsDb.callbackEvent.delete({ where: { id: event.id } });

    await auditingObjectDelete.enqueue(getChatEventPayloadsBucketName(), payloadKeys);
  }
);

export let systemEventCleanupCron = createCron(
  { name: 'auditing/systemEvent/cleanup/cron', cron: '0 * * * *' },
  async () => {
    let dueBefore = getRetentionCutoff().toISOString();

    await systemEventCleanupManyQueue.addManyWithOps(
      (['systemEvent', 'callbackEvent', 'chatEvent'] as SystemEventCleanupResource[]).map(
        (resource, index) => ({
          data: { resource, dueBefore },
          opts: { delay: index * 20_000 }
        })
      )
    );
  }
);

export let systemEventCleanupProcessors = combineQueueProcessors([
  systemEventCleanupManyProcessor,
  systemEventCleanupSingleProcessor,
  systemEventCleanupCron,
  auditingObjectDelete.processor
]);
