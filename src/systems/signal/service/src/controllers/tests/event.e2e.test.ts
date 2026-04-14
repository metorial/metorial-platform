import { beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, testDb } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { signalClient } from '../../test/client';

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
});
