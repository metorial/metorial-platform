import { ID, withTransaction } from '@metorial/db';
import type { StashedAuditEvent } from './stash';

let toOid = (value: bigint | string | number) => BigInt(value);

let toOptionalOid = (value?: bigint | string | number) =>
  value === undefined ? null : toOid(value);

export let ingestAuditEventToPostgres = async (event: StashedAuditEvent) => {
  await withTransaction(async db => {
    let organizationOid = toOid(event.organizationOid);
    let projectOid = toOptionalOid(event.projectOid);
    let instanceOid = toOptionalOid(event.instanceOid);
    let organizationActorOid = toOptionalOid(event.organizationActorOid);

    try {
      await db.event.create({
        data: {
          id: event.id,
          resource: event.resource,
          action: event.action,
          ip: event.context.ip,
          ua: event.context.ua ?? null,
          organizationOid,
          projectOid,
          instanceOid,
          organizationActorOid,
          actorType: event.actor?.type ?? null,
          actorId: event.actor?.id ?? null,
          actorMetadata: event.actor?.metadata,
          recordedAt: event.recordedAt,
          auditLogs: {
            create: {
              id: await ID.generateId('auditLog'),
              resource: event.resource,
              action: event.action,
              ip: event.context.ip,
              ua: event.context.ua ?? null,
              organizationOid,
              projectOid,
              instanceOid,
              organizationActorOid,
              actorType: event.actor?.type ?? null,
              actorId: event.actor?.id ?? null,
              actorMetadata: event.actor?.metadata,
              recordedAt: event.recordedAt
            }
          }
        }
      });

      await db.auditLogDirtyTracker.createMany({
        data: { organizationOid },
        skipDuplicates: true
      });
    } catch (error: any) {
      // Ignore duplicate key errors, as they indicate the event has already been ingested
      if (error.code === 'P2002') return;

      throw error;
    }
  });
};
