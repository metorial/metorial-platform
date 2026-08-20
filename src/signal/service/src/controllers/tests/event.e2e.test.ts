import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../env';
import { eventCleanupQueueProcessor } from '../../queues/send/cleanup';
import { storage } from '../../storage';
import { createTestSignalClient, signalClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';

describe('event.e2e', () => {
  const f = fixtures(testDb);
  let serviceCredential = 'hub-service-test-credential';
  let internalClient = createTestSignalClient({
    headers: { 'x-metorial-signal-service-credential': serviceCredential }
  });

  beforeEach(async () => {
    env.internal.HUB_SERVICE_CREDENTIAL = serviceCredential;
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

    await (eventCleanupQueueProcessor as any).handler({ eventId: event.id });

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

  it('authenticates idempotent create and returns the same committed event', async () => {
    let tenant = await f.tenant.default();
    let sender = await f.sender.default();
    let request = {
      tenantId: tenant.id,
      senderId: sender.id,
      idempotencyKey: 'hub-key-a',
      topics: ['orders'],
      eventType: 'order.created',
      payloadJson: '{"id":"order-a"}',
      headers: { 'content-type': 'application/json' }
    };
    let secondInternalClient = createTestSignalClient({
      headers: { 'x-metorial-signal-service-credential': serviceCredential }
    });
    let [first, duplicate] = await Promise.all([
      internalClient.event.createIdempotent(request),
      secondInternalClient.event.createIdempotent(request)
    ]);

    expect(duplicate).toEqual(first);
    expect(
      await testDb.event.count({ where: { idempotencyKey: request.idempotencyKey } })
    ).toBe(1);
  });

  it('lets one concurrent mismatched fingerprint win and rejects the other', async () => {
    let tenant = await f.tenant.default();
    let sender = await f.sender.default();
    let request = {
      tenantId: tenant.id,
      senderId: sender.id,
      idempotencyKey: 'hub-key-concurrent-conflict',
      topics: ['orders'],
      eventType: 'order.created',
      payloadJson: '{"id":"order-a"}',
      headers: {}
    };
    let secondInternalClient = createTestSignalClient({
      headers: { 'x-metorial-signal-service-credential': serviceCredential }
    });
    let results = await Promise.allSettled([
      internalClient.event.createIdempotent(request),
      secondInternalClient.event.createIdempotent({
        ...request,
        payloadJson: '{"id":"order-b"}'
      })
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({
      reason: { data: { code: 'idempotency_payload_conflict' } }
    });
    expect(
      await testDb.event.count({ where: { idempotencyKey: request.idempotencyKey } })
    ).toBe(1);
  });

  it('fails missing and invalid service credentials before key lookup', async () => {
    let tenant = await f.tenant.default();
    let invalidClient = createTestSignalClient({
      headers: { 'x-metorial-signal-service-credential': 'invalid' }
    });
    let lookup = { tenantId: tenant.id, idempotencyKey: 'unknown-key' };

    let missing = signalClient.event.getByIdempotencyKey(lookup).catch(error => error);
    let invalid = invalidClient.event.getByIdempotencyKey(lookup).catch(error => error);
    await expect(missing).resolves.toMatchObject({ data: { status: 401 } });
    await expect(invalid).resolves.toMatchObject({ data: { status: 401 } });
  });

  it('keeps idempotency lookups tenant-scoped and conflicts on changed fields', async () => {
    let tenantA = await f.tenant.default();
    let tenantB = await f.tenant.withIdentifier('tenant-b');
    let sender = await f.sender.default();
    let request = {
      tenantId: tenantA.id,
      senderId: sender.id,
      idempotencyKey: 'hub-key-isolated',
      topics: ['orders'],
      eventType: 'order.created',
      payloadJson: '{"id":"order-a"}',
      headers: {}
    };
    await internalClient.event.createIdempotent(request);
    await expect(
      internalClient.event.createIdempotent({
        ...request,
        payloadJson: '{"id":"order-b"}'
      })
    ).rejects.toMatchObject({ data: { code: 'idempotency_payload_conflict' } });
    await expect(
      internalClient.event.getByIdempotencyKey({
        tenantId: tenantB.id,
        idempotencyKey: request.idempotencyKey
      })
    ).rejects.toMatchObject({ data: { status: 404 } });
  });

});
