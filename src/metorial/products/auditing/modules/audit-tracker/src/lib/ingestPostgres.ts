import { ID, withTransaction } from '@metorial/db';
import type { StashedAuditEvent } from './stash';

let toOid = (value: bigint | string | number) => BigInt(value);

let toOptionalOid = (value?: bigint | string | number) =>
  value === undefined ? null : toOid(value);

let toEventRow = (event: StashedAuditEvent) => ({
  resource: event.resource,
  action: event.action,
  ip: event.context.ip,
  ua: event.context.ua ?? null,
  organizationOid: toOid(event.organizationOid),
  instanceOid: toOptionalOid(event.instanceOid),
  organizationActorOid: toOptionalOid(event.organizationActorOid),
  actorType: event.actor?.type ?? null,
  actorId: event.actor?.id ?? null,
  actorMetadata: event.actor?.metadata,
  recordedAt: event.recordedAt
});

export let ingestAuditEventsToPostgres = async (events: StashedAuditEvent[]) => {
  if (events.length == 0) return;

  await withTransaction(async db => {
    await db.event.createMany({
      data: events.map(event => ({
        id: event.id,
        ...toEventRow(event)
      })),
      skipDuplicates: true
    });

    let eventIds = events.map(event => event.id);
    let storedEvents = await db.event.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, oid: true }
    });
    let eventOidsById = new Map(storedEvents.map(event => [event.id, event.oid]));

    let existingAuditLogs = await db.auditLog.findMany({
      where: { eventOid: { in: [...eventOidsById.values()] } },
      select: { eventOid: true }
    });
    let alreadyIngestedEventOids = new Set(
      existingAuditLogs.flatMap(auditLog => (auditLog.eventOid ? [auditLog.eventOid] : []))
    );

    let auditLogs: ({ id: string; eventOid: bigint } & ReturnType<typeof toEventRow>)[] = [];
    for (let event of events) {
      let eventOid = eventOidsById.get(event.id);
      if (eventOid === undefined) continue;
      if (alreadyIngestedEventOids.has(eventOid)) continue;

      alreadyIngestedEventOids.add(eventOid);

      auditLogs.push({
        id: await ID.generateId('auditLog'),
        eventOid,
        ...toEventRow(event)
      });
    }

    if (auditLogs.length == 0) return;

    await db.auditLog.createMany({
      data: auditLogs,
      skipDuplicates: true
    });

    let organizationOids = [...new Set(auditLogs.map(auditLog => auditLog.organizationOid))];
    for (let organizationOid of organizationOids) {
      await db.auditLogDirtyTracker.upsert({
        where: { organizationOid },
        create: { organizationOid },
        update: { revision: { increment: 1 } }
      });
    }
  });
};

export let ingestAuditEventToPostgres = async (event: StashedAuditEvent) =>
  await ingestAuditEventsToPostgres([event]);
