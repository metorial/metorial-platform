import { withTransaction } from '@metorial/db';
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
    let eventIds = events.map(event => event.id);
    let existingAuditLogs = await db.auditLog.findMany({
      where: { id: { in: eventIds } },
      select: { id: true }
    });
    let alreadyIngestedIds = new Set(existingAuditLogs.map(auditLog => auditLog.id));

    let auditLogs: ({ id: string } & ReturnType<typeof toEventRow>)[] = [];
    for (let event of events) {
      if (alreadyIngestedIds.has(event.id)) continue;
      alreadyIngestedIds.add(event.id);

      auditLogs.push({
        id: event.id,
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
