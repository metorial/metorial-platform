import { Prisma, withTransaction } from '@metorial/db';
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

type PresentedEvent = { id: string; payload: unknown; previousAttributes?: unknown };

let jsonValue = (value: unknown) =>
  value === undefined || value === null
    ? Prisma.DbNull
    : JSON.parse(
        JSON.stringify(value, (_key, nested) =>
          typeof nested === 'bigint' ? String(nested) : nested
        )
      );

export let ingestAuditEventsToPostgres = async (
  events: StashedAuditEvent[],
  presented?: PresentedEvent[]
) => {
  if (events.length == 0) return;

  await withTransaction(async db => {
    let eventIds = events.map(event => event.id);
    let existingAuditLogs = await db.auditLog.findMany({
      where: { id: { in: eventIds } },
      select: { id: true }
    });
    let alreadyIngestedIds = new Set(existingAuditLogs.map(auditLog => auditLog.id));

    let presentedById = new Map(presented?.map(event => [event.id, event]));
    let auditLogs: Prisma.AuditLogCreateManyInput[] = [];
    for (let event of events) {
      if (alreadyIngestedIds.has(event.id)) continue;
      alreadyIngestedIds.add(event.id);

      auditLogs.push({
        id: event.id,
        ...toEventRow(event),
        ...(presented
          ? {
              payload: jsonValue(presentedById.get(event.id)?.payload),
              previousAttributes: jsonValue(presentedById.get(event.id)?.previousAttributes)
            }
          : {})
      });
    }

    if (auditLogs.length == 0) return;

    await db.auditLog.createMany({
      data: auditLogs,
      skipDuplicates: true
    });

    // Concurrent batches must lock tracker rows in the same order, or they deadlock each other.
    let organizationOids = [
      ...new Set(auditLogs.map(auditLog => auditLog.organizationOid))
    ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
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
