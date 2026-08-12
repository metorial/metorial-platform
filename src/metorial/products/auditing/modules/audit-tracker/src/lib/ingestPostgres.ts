import { ID, Prisma, withTransaction } from '@metorial/db';
import type { StashedAuditEvent } from './stash';

let toJsonValue = (value: unknown): Prisma.InputJsonValue => {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(item => toJsonValue(item));
  if (value && typeof value === 'object') {
    let out: Record<string, Prisma.InputJsonValue> = {};
    for (let [key, nested] of Object.entries(value)) {
      if (nested === undefined) continue;
      out[key] = nested === null ? (null as any) : toJsonValue(nested);
    }
    return out;
  }
  return value as Prisma.InputJsonValue;
};

let toNullableJson = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return toJsonValue(value);
};

let toOid = (value: bigint | string | number) => BigInt(value);

export let ingestAuditEventToPostgres = async (event: StashedAuditEvent) => {
  await withTransaction(async db => {
    let existing = await db.event.findUnique({
      where: { id: event.id },
      include: { auditLogs: { select: { oid: true }, take: 1 } }
    });

    if (existing) {
      if (existing.auditLogs.length == 0) {
        await db.auditLog.create({
          data: {
            id: await ID.generateId('auditLog'),
            resource: event.resource,
            action: event.action,
            ip: event.context.ip,
            ua: event.context.ua ?? null,
            payload: toJsonValue(event.payload),
            previousAttributes: toNullableJson(event.previousAttributes),
            resourceTenantOid: existing.resourceTenantOid,
            resourceGroupOid: existing.resourceGroupOid,
            resourceActorOid: existing.resourceActorOid,
            eventOid: existing.oid,
            recordedAt: event.recordedAt
          }
        });

        await db.auditLogDirtyTracker.upsert({
          where: { resourceTenantOid: existing.resourceTenantOid },
          create: { resourceTenantOid: existing.resourceTenantOid },
          update: {}
        });
      }

      return;
    }

    let resourceTenantOid = toOid(event.resourceTenantOid);
    let resourceGroupOid = toOid(event.resourceGroupOid);
    let resourceActorOid = toOid(event.resourceActorOid);
    let payload = toJsonValue(event.payload);
    let previousAttributes = toNullableJson(event.previousAttributes);

    await db.event.create({
      data: {
        id: event.id,
        resource: event.resource,
        action: event.action,
        ip: event.context.ip,
        ua: event.context.ua ?? null,
        payload,
        previousAttributes,
        resourceTenantOid,
        resourceGroupOid,
        resourceActorOid,
        recordedAt: event.recordedAt,
        auditLogs: {
          create: {
            id: await ID.generateId('auditLog'),
            resource: event.resource,
            action: event.action,
            ip: event.context.ip,
            ua: event.context.ua ?? null,
            payload,
            previousAttributes,
            resourceTenantOid,
            resourceGroupOid,
            resourceActorOid,
            recordedAt: event.recordedAt
          }
        }
      }
    });

    await db.auditLogDirtyTracker.upsert({
      where: { resourceTenantOid },
      create: { resourceTenantOid },
      update: {}
    });
  });
};
