import { beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, testDb } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { signalClient } from '../../test/client';
import { env } from '../../env';
import { storage } from '../../storage';
import { storageKey } from '../../lib/storageKey';

describe('eventDeliveryAttempt.e2e', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('gets and lists delivery attempts', async () => {
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
        payloadJson: JSON.stringify({ ok: true })
      }
    });
    const intent = await f.eventDeliveryIntent.default({
      eventOid: event.oid,
      destinationOid: destination.oid
    });
    const attempt = await f.eventDeliveryAttempt.default({
      intentOid: intent.oid,
      destinationInstanceOid: destination.currentInstance!.oid,
      overrides: {
        status: 'failed',
        responseStatusCode: 500
      }
    });
    await storage.upsertBucket(env.storage.LOGS_BUCKET_NAME);
    await storage.putObject(
      env.storage.LOGS_BUCKET_NAME,
      storageKey.attempt(attempt),
      JSON.stringify({ body: 'failed', headers: [] })
    );

    const fetched = await signalClient.eventDeliveryAttempt.get({
      tenantId: tenant.id,
      eventDeliveryAttemptId: attempt.id
    });

    expect(fetched).toMatchObject({
      id: attempt.id,
      status: 'failed',
      intent: {
        id: intent.id,
        event: { id: event.id }
      }
    });

    const listed = await signalClient.eventDeliveryAttempt.list({
      tenantId: tenant.id,
      intentIds: [intent.id],
      limit: 10
    });

    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.id).toBe(attempt.id);
  });
});
