import { Prisma, type TriggerRawEventSource } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { triggerRawEventPayloadOffloadQueue } from './payloadOffload';
import { triggerRawEventMappingQueue } from './rawEventMapping';

// Tenants that have callbacks disabled must never have trigger data persisted for them.
let getDisabledTriggerRegistrationInstanceOids = async (oids: bigint[]) => {
  if (oids.length === 0) return new Set<bigint>();

  let disabled = await db.triggerRegistrationInstance.findMany({
    where: {
      oid: { in: oids },
      triggerRegistration: { tenant: { disableCallbacks: true } }
    },
    select: { oid: true }
  });

  return new Set(disabled.map(row => row.oid));
};

export let createTriggerRawEvents = async (d: {
  source: TriggerRawEventSource;
  webhookEventOid?: bigint;
  events: {
    triggerRegistrationInstanceOids: bigint[];
    payload: PrismaJson.AnyRecord;
    idempotencyKey?: string | null;
    triggerIds: string[];
    matchers?: PrismaJson.TriggerRawEventMatchers | null;
  }[];
}) => {
  let allOids = [...new Set(d.events.flatMap(event => event.triggerRegistrationInstanceOids))];
  let disabledOids = await getDisabledTriggerRegistrationInstanceOids(allOids);

  let hadCandidates = false;
  let hasRemainingCandidates = false;

  let filteredEvents = d.events.map(event => {
    if (event.triggerRegistrationInstanceOids.length > 0) hadCandidates = true;

    let triggerRegistrationInstanceOids = event.triggerRegistrationInstanceOids.filter(
      oid => !disabledOids.has(oid)
    );
    if (triggerRegistrationInstanceOids.length > 0) hasRemainingCandidates = true;

    return { ...event, triggerRegistrationInstanceOids };
  });

  let rows = filteredEvents.flatMap(event =>
    event.triggerRegistrationInstanceOids.map(triggerRegistrationInstanceOid => ({
      ...getId('triggerRawEvent'),
      source: d.source,
      triggerRegistrationInstanceOid,
      webhookEventOid: d.webhookEventOid ?? null,
      payload: event.payload,
      idempotencyKey: event.idempotencyKey ?? null,
      triggerIds: event.triggerIds,
      pendingTriggerMapCount: event.triggerIds.length,
      matchers: event.matchers ?? Prisma.DbNull
    }))
  );

  if (rows.length === 0)
    return { created: [] as { id: string }[], hadCandidates, hasRemainingCandidates };

  let created = await db.triggerRawEvent.createManyAndReturn({
    skipDuplicates: true,
    data: rows,
    select: { id: true }
  });

  if (created.length > 0) {
    await triggerRawEventMappingQueue.addMany(created.map(row => ({ rawEventId: row.id })));
  }

  return { created, hadCandidates, hasRemainingCandidates };
};

export let decrementPendingTriggerMapCount = async (d: { rawEventOid: bigint }) => {
  let updated = await db.triggerRawEvent.update({
    where: { oid: d.rawEventOid },
    data: { pendingTriggerMapCount: { decrement: 1 } }
  });

  if (updated.processingStatus === 'failed') {
    await maybeFinalizeFailedRawEvent({ rawEventOid: updated.oid, rawEventId: updated.id });
  }

  return updated;
};

export let markRawEventProcessingFailed = async (d: { rawEventOid: bigint }) => {
  let updated = await db.triggerRawEvent.update({
    where: { oid: d.rawEventOid },
    data: { processingStatus: 'failed' }
  });

  await maybeFinalizeFailedRawEvent({ rawEventOid: updated.oid, rawEventId: updated.id });
};

let maybeFinalizeFailedRawEvent = async (d: { rawEventOid: bigint; rawEventId: string }) => {
  let pendingChildren = await db.triggerEvent.count({
    where: {
      rawEventOid: d.rawEventOid,
      status: { in: ['pending', 'mapping_failed'] }
    }
  });
  if (pendingChildren > 0) return;

  await triggerRawEventPayloadOffloadQueue.add({ rawEventId: d.rawEventId });
};
