import { ingestAuditEvents } from '@metorial/audit-models';
import { createCron } from '@metorial/cron';
import { createQueue } from '@metorial/queue';
import { createHash } from 'node:crypto';
import { ingestAuditEventsToPostgres } from '../lib/ingestPostgres';
import { presentStashedAuditEvent } from '../lib/present';
import {
  acknowledgeClaimedAuditEvent,
  claimAuditEvents,
  decodeStashedAuditEvent,
  listClaimedAuditEvents,
  type StashedAuditEvent
} from '../lib/stash';

let AUDIT_EVENT_BATCH_SIZE = 100;

export interface ProcessAuditEventItem {
  event: StashedAuditEvent;
  encodedEvent: string;
}

export interface ProcessAuditEventJob {
  events: ProcessAuditEventItem[];
}

export let processAuditEventQueue = createQueue<ProcessAuditEventJob>({
  name: 'audit/event/process',
  jobOpts: {
    removeOnComplete: {
      age: 5 * 60
    }
  }
});

let getBatchJobId = (items: ProcessAuditEventItem[]) =>
  createHash('sha1')
    .update(items.map(item => item.event.id).join(','))
    .digest('hex');

let enqueueClaimedEvents = async (encodedEvents: string[]) => {
  if (encodedEvents.length == 0) return;

  let items = encodedEvents.map(encodedEvent => ({
    event: decodeStashedAuditEvent(encodedEvent),
    encodedEvent
  }));

  await processAuditEventQueue.add(
    { events: items },
    { id: `audit-batch-${getBatchJobId(items)}` }
  );
};

export let collectAuditEventsCron = createCron(
  {
    name: 'audit/event/collect',
    cron: '* * * * *'
  },
  async () => {
    let previouslyClaimedEvents = await listClaimedAuditEvents();
    for (let i = 0; i < previouslyClaimedEvents.length; i += AUDIT_EVENT_BATCH_SIZE) {
      await enqueueClaimedEvents(previouslyClaimedEvents.slice(i, i + AUDIT_EVENT_BATCH_SIZE));
    }

    while (true) {
      let encodedEvents = await claimAuditEvents(AUDIT_EVENT_BATCH_SIZE);
      if (encodedEvents.length == 0) return;

      await enqueueClaimedEvents(encodedEvents);
    }
  }
);

export let processAuditEventQueueProcessor = processAuditEventQueue.process(async data => {
  let items: ProcessAuditEventItem[] = data.events ?? [
    data as unknown as ProcessAuditEventItem
  ];
  if (items.length == 0) return;

  let presentedEvents = await Promise.all(
    items.map(item => presentStashedAuditEvent(item.event))
  );

  await ingestAuditEvents(presentedEvents);
  await ingestAuditEventsToPostgres(items.map(item => item.event));

  for (let item of items) {
    await acknowledgeClaimedAuditEvent(item.encodedEvent);
  }
});
