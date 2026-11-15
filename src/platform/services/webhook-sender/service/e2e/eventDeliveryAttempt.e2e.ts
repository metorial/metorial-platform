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

describe('signal event delivery attempt', () => {
  it('gets and lists delivery attempts', async () => {
    let tenant = await createTenant();
    let sender = await createSender();
    let destination = await createDestination({ tenantId: tenant.id, senderId: sender.id });
    let event = await createEvent({
      tenantOid: tenant.oid,
      senderOid: sender.oid,
      overrides: { payloadJson: JSON.stringify({ ok: true }) }
    });
    let intent = await createIntent({ eventOid: event.oid, destinationOid: destination.oid });
    let attempt = await createAttempt({
      intentOid: intent.oid,
      destinationInstanceOid: destination.currentInstance!.oid,
      overrides: { status: 'failed', responseStatusCode: 500 }
    });

    await storage.upsertBucket(env.storage.LOGS_BUCKET_NAME);
    await storage.putObject(
      env.storage.LOGS_BUCKET_NAME,
      storageKey.attempt(attempt),
      JSON.stringify({ body: 'failed', headers: [] })
    );

    let fetched = await signal.eventDeliveryAttempt.get({
      tenantId: tenant.id,
      eventDeliveryAttemptId: attempt.id
    });

    expect(fetched).toMatchObject({
      id: attempt.id,
      status: 'failed',
      response: { statusCode: 500, body: 'failed' },
      intent: {
        id: intent.id,
        event: { id: event.id, request: { body: event.payloadJson } }
      }
    });

    let listed = await signal.eventDeliveryAttempt.list({
      tenantId: tenant.id,
      intentIds: [intent.id],
      limit: 10
    });

    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.id).toBe(attempt.id);
    expect(listed.items[0]?.response).toMatchObject({ statusCode: 500, body: null });
    expect(listed.items[0]?.intent.event.request).toBeNull();
  });
});
