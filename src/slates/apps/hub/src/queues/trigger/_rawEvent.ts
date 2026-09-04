import { Prisma, type TriggerRawEventSource } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { triggerRawEventMappingQueue } from './rawEventMapping';

export let createTriggerRawEvents = async (d: {
  source: TriggerRawEventSource;
  events: {
    triggerRegistrationInstanceOids: bigint[];
    payload: PrismaJson.AnyRecord;
    idempotencyKey?: string | null;
    triggerIds: string[];
    matchers?: PrismaJson.TriggerRawEventMatchers | null;
  }[];
}) => {
  let rows = d.events.flatMap(event =>
    event.triggerRegistrationInstanceOids.map(triggerRegistrationInstanceOid => ({
      ...getId('triggerRawEvent'),
      source: d.source,
      triggerRegistrationInstanceOid,
      payload: event.payload,
      idempotencyKey: event.idempotencyKey ?? null,
      triggerIds: event.triggerIds,
      matchers: event.matchers ?? Prisma.DbNull
    }))
  );

  if (rows.length === 0) return [];

  let created = await db.triggerRawEvent.createManyAndReturn({
    skipDuplicates: true,
    data: rows,
    select: { id: true }
  });

  if (created.length > 0) {
    await triggerRawEventMappingQueue.addMany(created.map(row => ({ rawEventId: row.id })));
  }

  return created;
};
