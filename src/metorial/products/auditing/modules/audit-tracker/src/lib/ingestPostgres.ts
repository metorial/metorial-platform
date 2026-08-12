import { ID, withTransaction } from '@metorial/db';
import type { StashedAuditEvent } from './stash';

let toOid = (value: bigint | string | number) => BigInt(value);

export let ingestAuditEventToPostgres = async (event: StashedAuditEvent) => {
  await withTransaction(async db => {
    let resourceTenantOid = toOid(event.resourceTenantOid);
    let resourceGroupOid = toOid(event.resourceGroupOid);
    let resourceActorOid = toOid(event.resourceActorOid);

    try {
      await db.event.create({
        data: {
          id: event.id,
          resource: event.resource,
          action: event.action,
          ip: event.context.ip,
          ua: event.context.ua ?? null,
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
              resourceTenantOid,
              resourceGroupOid,
              resourceActorOid,
              recordedAt: event.recordedAt
            }
          }
        }
      });

      await db.auditLogDirtyTracker.createMany({
        data: { resourceTenantOid },
        skipDuplicates: true
      });
    } catch (error: any) {
      // Ignore duplicate key errors, as they indicate the event has already been ingested
      if (error.code === 'P2002') return;

      throw error;
    }
  });
};
