import { Prisma, type TriggerRawEventSource } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { TRIGGER_DISPATCH_RECHECK_DELAY_MS } from './_config';
import { enqueueTriggerRawEventMapping } from './rawEventMapping';

export type TriggerRawEventInput = {
  triggerRegistrationInstanceOids: bigint[];
  payload: PrismaJson.AnyRecord;
  idempotencyKey?: string | null;
  triggerIds: string[];
  matchers?: PrismaJson.TriggerRawEventMatchers | null;
};

export let findAllowedTriggerInstances = async (
  tx: Prisma.TransactionClient,
  oids: bigint[]
) => {
  if (!oids.length) return [];
  await tx.$queryRaw`SELECT t."oid" FROM "Tenant" t
    JOIN "TriggerRegistration" r ON r."tenantOid" = t."oid"
    JOIN "TriggerRegistrationInstance" i ON i."triggerRegistrationOid" = r."oid"
    WHERE i."oid" IN (${Prisma.join(oids)}) FOR SHARE OF t, r`;
  return tx.triggerRegistrationInstance.findMany({
    where: {
      oid: { in: oids },
      triggerRegistration: { status: 'active', tenant: { disableCallbacks: false } }
    },
    select: { oid: true }
  });
};

export let persistTriggerRawEvents = async (
  tx: Prisma.TransactionClient,
  d: {
    source: TriggerRawEventSource;
    webhookEventOid?: bigint | null;
    events: TriggerRawEventInput[];
  }
) => {
  let allOids = [...new Set(d.events.flatMap(event => event.triggerRegistrationInstanceOids))];
  let instances = await findAllowedTriggerInstances(tx, allOids);
  let allowed = new Set(instances.map(instance => instance.oid));
  let rows = d.events.flatMap(event =>
    event.triggerRegistrationInstanceOids
      .filter(oid => allowed.has(oid))
      .map(oid => ({
        ...getId('triggerRawEvent'),
        source: d.source,
        triggerRegistrationInstanceOid: oid,
        webhookEventOid: d.webhookEventOid ?? null,
        payload: event.payload,
        idempotencyKey: event.idempotencyKey ?? null,
        triggerIds: event.triggerIds,
        pendingTriggerMapCount: event.triggerIds.length,
        matchers: event.matchers ?? Prisma.DbNull
      }))
  );
  let created = rows.length
    ? await tx.triggerRawEvent.createManyAndReturn({
        skipDuplicates: true,
        data: rows,
        select: { id: true, oid: true }
      })
    : [];

  if (created.length) {
    let nextAttemptAt = new Date(Date.now() + TRIGGER_DISPATCH_RECHECK_DELAY_MS);

    await tx.triggerRawEventDispatch.createMany({
      data: created.map(row => ({ rawEventOid: row.oid, nextAttemptAt })),
      skipDuplicates: true
    });
  }

  return {
    created,
    hadCandidates: allOids.length > 0,
    hasRemainingCandidates: allowed.size > 0
  };
};

export let createTriggerRawEvents = async (d: {
  source: TriggerRawEventSource;
  webhookEventOid?: bigint;
  events: TriggerRawEventInput[];
}) => {
  let result = await db.$transaction(tx => persistTriggerRawEvents(tx, d));

  await enqueueTriggerRawEventMapping(result.created);

  return result;
};
