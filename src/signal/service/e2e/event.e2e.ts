import { eventually } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { env } from '../src/env';
import { db } from '../src/db';
import { eventCleanupQueue } from '../src/queues/send/cleanup';
import { storage } from '../src/storage';
import { signal } from './client';
import { createEvent, createSender, createTenant } from './fixtures';

describe('signal event', () => {
  it('gets a single event by id', async () => {
    let tenant = await createTenant();
    let sender = await createSender();
    let payloadJson = JSON.stringify({ ok: true });

    let event = await createEvent({
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      overrides: { eventType: 'user.created', topics: ['user'], payloadJson }
    });

    let result = await signal.event.get({ tenantId: tenant.id, eventId: event.id });

    expect(result).toMatchObject({
      id: event.id,
      type: 'user.created',
      topics: ['user'],
      sender: { id: sender.id },
      request: { body: payloadJson }
    });
  });

  it('lists events for a tenant only', async () => {
    let tenantA = await createTenant();
    let tenantB = await createTenant();
    let sender = await createSender();

    let eventA1 = await createEvent({ tenantOid: tenantA.oid, senderOid: sender.oid });
    let eventA2 = await createEvent({ tenantOid: tenantA.oid, senderOid: sender.oid });
    await createEvent({ tenantOid: tenantB.oid, senderOid: sender.oid });

    let result = await signal.event.list({ tenantId: tenantA.id, limit: 10 });

    expect(result.items).toHaveLength(2);
    expect(result.items.map(item => item.id)).toEqual(
      expect.arrayContaining([eventA1.id, eventA2.id])
    );
  });

  it('reads event payloads after cleanup offloads them to storage', async () => {
    let tenant = await createTenant();
    let sender = await createSender();
    let payloadJson = JSON.stringify({ offloaded: true });

    await storage.upsertBucket(env.storage.LOGS_BUCKET_NAME);

    let event = await createEvent({
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      overrides: { payloadJson, headers: [['content-type', 'application/json']] }
    });

    await eventCleanupQueue.add({ eventId: event.id });

    await eventually(async () => {
      let offloaded = await db.event.findUniqueOrThrow({ where: { id: event.id } });
      expect(offloaded.payloadJson).toBeNull();
      expect(offloaded.headers).toEqual([]);
    });

    let result = await signal.event.get({ tenantId: tenant.id, eventId: event.id });

    expect(result).toMatchObject({
      id: event.id,
      request: {
        body: payloadJson,
        headers: [{ key: 'content-type', value: 'application/json' }]
      }
    });
  });
});
