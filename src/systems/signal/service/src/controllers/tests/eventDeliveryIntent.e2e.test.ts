import { beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, testDb } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { signalClient } from '../../test/client';

describe('eventDeliveryIntent.e2e', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('gets and lists delivery intents', async () => {
    const tenant = await f.tenant.default();
    const sender = await f.sender.default();

    const destination = await f.eventDestination.default({
      tenantOid: tenant.oid,
      senderOid: sender.oid
    });
    const event = await f.event.default({
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      overrides: {
        eventType: 'user.created',
        topics: ['user'],
        payloadJson: JSON.stringify({ ok: true })
      }
    });
    const intent = await f.eventDeliveryIntent.default({
      eventOid: event.oid,
      destinationOid: destination.oid
    });

    const fetched = await signalClient.eventDeliveryIntent.get({
      tenantId: tenant.id,
      eventDeliveryIntentId: intent.id
    });

    expect(fetched).toMatchObject({
      id: intent.id,
      status: intent.status,
      event: {
        id: event.id,
        request: { body: event.payloadJson }
      },
      destination: { id: destination.id }
    });

    const listed = await signalClient.eventDeliveryIntent.list({
      tenantId: tenant.id,
      eventIds: [event.id],
      limit: 10
    });

    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.id).toBe(intent.id);
  });
});
