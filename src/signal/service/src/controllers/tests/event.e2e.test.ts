import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../env';
import { cleanupEvent } from '../../queues/send/cleanup';
import { storage } from '../../storage';
import { signalClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';

describe('event.e2e', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('gets a single event by id', async () => {
    const tenant = await f.tenant.default();
    const sender = await f.sender.default();
    const payloadJson = JSON.stringify({ ok: true });

    const event = await f.event.default({
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      overrides: {
        eventType: 'user.created',
        topics: ['user'],
        payloadJson
      }
    });

    const result = await signalClient.event.get({
      tenantId: tenant.id,
      eventId: event.id
    });

    expect(result).toMatchObject({
      id: event.id,
      type: 'user.created',
      topics: ['user'],
      sender: { id: sender.id },
      request: { body: payloadJson }
    });
  });

  it('lists events for a tenant', async () => {
    const tenantA = await f.tenant.default();
    const tenantB = await f.tenant.withIdentifier('other-tenant');
    const senderA = await f.sender.default();
    const senderB = await f.sender.default();

    const eventA1 = await f.event.default({
      tenantOid: tenantA.oid,
      senderOid: senderA.oid
    });
    const eventA2 = await f.event.default({
      tenantOid: tenantA.oid,
      senderOid: senderA.oid
    });
    await f.event.default({
      tenantOid: tenantB.oid,
      senderOid: senderB.oid
    });

    const result = await signalClient.event.list({
      tenantId: tenantA.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.map(item => item.id)).toEqual(
      expect.arrayContaining([eventA1.id, eventA2.id])
    );
  });

  it('reads event payloads after cleanup offloads them to storage', async () => {
    let tenant = await f.tenant.default();
    let sender = await f.sender.default();
    let payloadJson = JSON.stringify({ offloaded: true });

    await storage.upsertBucket(env.storage.LOGS_BUCKET_NAME);

    let event = await f.event.default({
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      overrides: {
        payloadJson,
        headers: [['content-type', 'application/json']]
      }
    });

    await cleanupEvent({ eventId: event.id });

    let offloaded = await testDb.event.findUniqueOrThrow({
      where: { id: event.id }
    });

    expect(offloaded.payloadJson).toBeNull();
    expect(offloaded.headers).toEqual([]);

    let result = await signalClient.event.get({
      tenantId: tenant.id,
      eventId: event.id
    });

    expect(result).toMatchObject({
      id: event.id,
      request: {
        body: payloadJson,
        headers: [{ key: 'content-type', value: 'application/json' }]
      }
    });
  });
});
