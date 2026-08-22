import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../queues/send/init', () => ({
  newEventQueue: { add: vi.fn() }
}));
import { env } from '../../env';
import { cleanupEvent } from '../../queues/send/cleanup';
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

  it('lists events within the requested scope', async () => {
    let tenant = await f.tenant.default();
    let sender = await f.sender.default();
    let included = await f.event.default({
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      overrides: { scopeId: 'environment-a' }
    });
    await f.event.default({
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      overrides: { scopeId: 'environment-b' }
    });

    let result = await signalClient.event.list({
      tenantId: tenant.id,
      scopeIds: ['environment-a'],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: included.id,
      scopeId: 'environment-a'
    });
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

  it('authenticates idempotent create and returns the exact narrow response', async () => {
    let tenant = await f.tenant.default();
    let sender = await f.sender.default();
    let request = {
      tenantId: tenant.id,
      senderId: sender.id,
      idempotencyKey: 'hub-key-a',
      scopeId: 'environment-a',
      topics: ['orders'],
      eventType: 'order.created',
      payloadJson: '{"id":"order-a"}',
      headers: { 'content-type': 'application/json' }
    };

    let first = await internalClient.event.createIdempotent(request);
    let duplicate = await internalClient.event.createIdempotent(request);
    let lookup = await internalClient.event.getByIdempotencyKey({
      tenantId: tenant.id,
      idempotencyKey: request.idempotencyKey
    });

    expect(duplicate).toEqual(first);
    expect(lookup).toEqual(first);
    expect(Object.keys(first).sort()).toEqual(['id', 'idempotencyKey', 'requestFingerprint']);
    expect(
      await testDb.event.count({ where: { idempotencyKey: request.idempotencyKey } })
    ).toBe(1);
  });

  it('recovers a concurrent unique-key race and rejects a mismatched winner', async () => {
    let tenant = await f.tenant.default();
    let sender = await f.sender.default();
    let request = {
      tenantId: tenant.id,
      senderId: sender.id,
      idempotencyKey: 'hub-key-concurrent',
      scopeId: 'environment-concurrent',
      topics: ['orders'],
      eventType: 'order.created',
      payloadJson: '{"id":"order-a"}',
      headers: {}
    };
    let secondClient = createTestSignalClient({
      headers: { 'x-metorial-signal-service-credential': serviceCredential }
    });
    let matching = await Promise.all([
      internalClient.event.createIdempotent(request),
      secondClient.event.createIdempotent(request)
    ]);

    expect(matching[1]).toEqual(matching[0]);
    await expect(
      secondClient.event.createIdempotent({ ...request, payloadJson: '{"id":"order-b"}' })
    ).rejects.toMatchObject({ data: { code: 'idempotency_payload_conflict' } });
  });

  it('rejects missing and invalid credentials before tenant/key lookup', async () => {
    let invalidClient = createTestSignalClient({
      headers: { 'x-metorial-signal-service-credential': 'invalid' }
    });
    let lookup = { tenantId: 'tenant-does-not-exist', idempotencyKey: 'unknown-key' };

    await expect(signalClient.event.getByIdempotencyKey(lookup)).rejects.toMatchObject({
      data: { status: 401 }
    });
    await expect(invalidClient.event.getByIdempotencyKey(lookup)).rejects.toMatchObject({
      data: { status: 401 }
    });
  });

  it('keeps idempotency lookup tenant-scoped', async () => {
    let tenantA = await f.tenant.default();
    let tenantB = await f.tenant.withIdentifier('tenant-b');
    let sender = await f.sender.default();
    let request = {
      tenantId: tenantA.id,
      senderId: sender.id,
      idempotencyKey: 'hub-key-isolated',
      scopeId: 'environment-isolated',
      topics: ['orders'],
      eventType: 'order.created',
      payloadJson: '{"id":"order-a"}',
      headers: {}
    };

    await internalClient.event.createIdempotent(request);
    await expect(
      internalClient.event.getByIdempotencyKey({
        tenantId: tenantB.id,
        idempotencyKey: request.idempotencyKey
      })
    ).rejects.toMatchObject({ data: { status: 404 } });
  });
});
