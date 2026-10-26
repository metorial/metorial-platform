import { db } from '@metorial/db';
import { eventually, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { resolveSystemEventPayload } from '../src';
import { auditingObjectDelete } from '../src/queues/objectDelete';
import {
  eventPayloadFlushManyQueue,
  eventPayloadFlushSingleQueue,
  flushEventPayload
} from '../src/queues/payloadFlush';
import { SYSTEM_EVENT_RETENTION_DAYS } from '../src/queues/systemEventCleanup';
import { getEventPayloadsBucketName, getStorage } from '../src/storage';
import {
  createSystemEventRow,
  readStoredPayload,
  storedPayloadExists,
  triggerCron,
  waitForQueueJob
} from './_fixtures';

let HOUR_MS = 60 * 60 * 1000;
let DAY_MS = 24 * HOUR_MS;

describe('module-event-tracker payloads', () => {
  let org = useOrganization();

  it('moves an inline payload to object storage and clears the column', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let payload = { object: 'e2e', marker: uniqueId('e2e-payload'), nested: { count: 3 } };
    let event = await createSystemEventRow(fixture, { payload });

    let jobId = uniqueId('e2e-flush');
    await eventPayloadFlushSingleQueue.add({ eventId: event.id }, { id: jobId });
    await waitForQueueJob(eventPayloadFlushSingleQueue.name, jobId);

    let flushed = await db.systemEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(flushed.payloadJson).toBeNull();
    expect(flushed.payloadStorageKey).toBe(event.id);

    expect(await readStoredPayload(event.id)).toEqual(payload);
    expect(await resolveSystemEventPayload(flushed)).toEqual(payload);
  });

  it('flushes only events created before the cutoff', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let due = await createSystemEventRow(fixture, { ageMs: 2 * HOUR_MS });
    let recent = await createSystemEventRow(fixture);

    let jobId = uniqueId('e2e-flush-many');
    await eventPayloadFlushManyQueue.add(
      { dueBefore: new Date(Date.now() - HOUR_MS).toISOString() },
      { id: jobId }
    );
    await waitForQueueJob(eventPayloadFlushManyQueue.name, jobId);

    await eventually(
      async () => {
        let row = await db.systemEvent.findUniqueOrThrow({ where: { id: due.id } });
        expect(row).toMatchObject({ payloadJson: null, payloadStorageKey: due.id });
      },
      { timeoutMs: 60_000, intervalMs: 1_000 }
    );
    expect(await readStoredPayload(due.id)).toEqual(due.payloadJson);

    let untouched = await db.systemEvent.findUniqueOrThrow({ where: { id: recent.id } });
    expect(untouched).toMatchObject({
      payloadStorageKey: null,
      payloadJson: recent.payloadJson
    });
    expect(await storedPayloadExists(recent.id)).toBe(false);
  }, 90_000);

  it('leaves flushed, payload-less and missing events alone', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let flushed = await createSystemEventRow(fixture);
    let empty = await createSystemEventRow(fixture, { payload: null });

    expect(await flushEventPayload({ eventId: flushed.id })).toBe(true);
    let stored = await readStoredPayload(flushed.id);

    expect(await flushEventPayload({ eventId: flushed.id })).toBe(false);
    expect(await flushEventPayload({ eventId: empty.id })).toBe(false);
    expect(await flushEventPayload({ eventId: uniqueId('sev_missing') })).toBe(false);

    expect(await readStoredPayload(flushed.id)).toEqual(stored);
    expect(await storedPayloadExists(empty.id)).toBe(false);
    expect(await db.systemEvent.findUniqueOrThrow({ where: { id: empty.id } })).toMatchObject({
      payloadJson: null,
      payloadStorageKey: null
    });
    expect(await resolveSystemEventPayload(empty)).toBeNull();
  });

  it('deletes events past retention together with their stored payloads', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let expiredAge = (SYSTEM_EVENT_RETENTION_DAYS + 2) * DAY_MS;

    let expiredStored = await createSystemEventRow(fixture, { ageMs: expiredAge });
    expect(await flushEventPayload({ eventId: expiredStored.id })).toBe(true);
    let expiredInline = await createSystemEventRow(fixture, { ageMs: expiredAge });
    let kept = await createSystemEventRow(fixture, {
      ageMs: (SYSTEM_EVENT_RETENTION_DAYS - 1) * DAY_MS
    });
    expect(await flushEventPayload({ eventId: kept.id })).toBe(true);

    await triggerCron('auditing/systemEvent/cleanup/cron');

    await eventually(
      async () => {
        expect(
          await db.systemEvent.count({
            where: { id: { in: [expiredStored.id, expiredInline.id] } }
          })
        ).toBe(0);
        expect(await storedPayloadExists(expiredStored.id)).toBe(false);
      },
      { timeoutMs: 90_000, intervalMs: 1_000 }
    );

    expect(await db.systemEvent.findUnique({ where: { id: kept.id } })).not.toBeNull();
    expect(await storedPayloadExists(kept.id)).toBe(true);
  }, 120_000);

  it('deletes stored objects through the object delete queue and tolerates missing keys', async () => {
    let bucket = getEventPayloadsBucketName();
    let keys = [uniqueId('e2e-object'), uniqueId('e2e-object')];
    for (let key of keys) {
      await getStorage().putObject(bucket, key, JSON.stringify({ key }), 'application/json');
    }
    let survivor = uniqueId('e2e-object');
    await getStorage().putObject(bucket, survivor, '{}', 'application/json');

    await auditingObjectDelete.enqueue(bucket, [...keys, uniqueId('e2e-object-missing')]);

    await eventually(
      async () => {
        for (let key of keys) expect(await storedPayloadExists(key)).toBe(false);
      },
      { timeoutMs: 60_000, intervalMs: 1_000 }
    );
    expect(await storedPayloadExists(survivor)).toBe(true);

    await getStorage().deleteObject(bucket, survivor);
  }, 90_000);
});
