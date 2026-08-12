import { ingestAuditEvent } from '@metorial/audit-models';
import { createCron } from '@metorial/cron';
import { createQueue } from '@metorial/queue';
import { ingestAuditEventToPostgres } from '../lib/ingestPostgres';
import {
  acknowledgeClaimedAuditEvent,
  claimAuditEvents,
  decodeStashedAuditEvent,
  listClaimedAuditEvents,
  type StashedAuditEvent
} from '../lib/stash';

let AUDIT_EVENT_BATCH_SIZE = 10;

export interface ProcessAuditEventJob {
  event: StashedAuditEvent;
  encodedEvent: string;
}

export let processAuditEventQueue = createQueue<ProcessAuditEventJob>({
  name: 'audit/event/process',
  jobOpts: {
    removeOnComplete: {
      age: 5 * 60
    }
  }
});

let enqueueClaimedEvents = async (encodedEvents: string[]) => {
  await processAuditEventQueue.addManyWithOps(
    encodedEvents.map(encodedEvent => {
      let event = decodeStashedAuditEvent(encodedEvent);

      return {
        data: {
          event,
          encodedEvent
        },
        opts: {
          id: event.id
        }
      };
    })
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
  await ingestAuditEvent(data.event);
  await ingestAuditEventToPostgres(data.event);
  await acknowledgeClaimedAuditEvent(data.encodedEvent);
});
