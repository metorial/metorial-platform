import { describe, expect, it } from 'vitest';
import { env } from '../src/env';
import { storageKey } from '../src/lib/storageKey';
import { storage } from '../src/storage';
import { signal } from './client';
import {
  createAttempt,
  createDestination,
  createEvent,
  createIntent,
  createSender,
  createTenant
} from './fixtures';

describe('signal event delivery intent', () => {
  it('gets and lists delivery intents', async () => {
    let tenant = await createTenant();
    let sender = await createSender();
    let destination = await createDestination({ tenantId: tenant.id, senderId: sender.id });
    let event = await createEvent({
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      overrides: {
        eventType: 'user.created',
        topics: ['user'],
        payloadJson: JSON.stringify({ ok: true })
      }
    });
    let intent = await createIntent({ eventOid: event.oid, destinationOid: destination.oid });
    let attempt = await createAttempt({
      intentOid: intent.oid,
      destinationInstanceOid: destination.currentInstance!.oid,
      overrides: { status: 'failed', attemptNumber: 1, responseStatusCode: 500 }
    });

    await storage.upsertBucket(env.storage.LOGS_BUCKET_NAME);
    await storage.putObject(
      env.storage.LOGS_BUCKET_NAME,
      storageKey.attempt(attempt),
      JSON.stringify({
        body: JSON.stringify({ error: 'boom' }),
        headers: [['content-type', 'application/json']]
      })
    );

    let fetched = await signal.eventDeliveryIntent.get({
      tenantId: tenant.id,
      eventDeliveryIntentId: intent.id
    });

    expect(fetched).toMatchObject({
      id: intent.id,
      status: intent.status,
      event: { id: event.id, request: { body: event.payloadJson } },
      destination: { id: destination.id },
      attempts: [
        {
          id: attempt.id,
          status: 'failed',
          attemptNumber: 1,
          response: { statusCode: 500, body: JSON.stringify({ error: 'boom' }) }
        }
      ]
    });

    let listed = await signal.eventDeliveryIntent.list({
      tenantId: tenant.id,
      eventIds: [event.id],
      limit: 10
    });

    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.id).toBe(intent.id);
    expect(listed.items[0]?.event.request).toBeNull();
    expect(listed.items[0]?.attempts).toBeNull();
  });
});
