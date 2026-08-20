import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../env';
import { storageKey } from '../../lib/storageKey';
import { storage } from '../../storage';
import { signalClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';

describe('callback.e2e', () => {
  let f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
    await storage.upsertBucket(env.storage.LOGS_BUCKET_NAME);
  });

  it('issues generated material only on create and redacts reusable callback reads', async () => {
    let tenant = await f.tenant.default();
    let input = {
      tenantId: tenant.id,
      callbackId: 'callback-secret-boundary',
      name: 'Callback secret boundary',
      destinations: [
        {
          externalId: 'callback-secret-destination',
          name: 'Callback endpoint',
          variant: {
            type: 'http_endpoint' as const,
            url: 'https://example.com/callback',
            method: 'POST' as const
          }
        }
      ]
    };
    let created = await signalClient.callback.upsert(input);
    expect(created.secretIssuanceReceipts).toHaveLength(1);
    expect(JSON.stringify(created)).not.toMatch(
      /signingSecret|encryptedValue|encryptionKeyVersion/
    );

    let updated = await signalClient.callback.upsert(input);
    expect(updated.secretIssuanceReceipts).toHaveLength(0);
    let fetched = await signalClient.callback.get({
      tenantId: tenant.id,
      callbackId: input.callbackId
    });
    expect(JSON.stringify(fetched)).not.toMatch(
      /secretIssuanceReceipt|signingSecret|encryptedValue|encryptionKeyVersion/
    );
  });

  it('offloads callback event input and output payloads asynchronously', async () => {
    let tenant = await f.tenant.default();
    let inputJson = JSON.stringify({ stage: 'input', ok: true });
    let outputJson = JSON.stringify({ stage: 'output', ok: true });

    await signalClient.callback.upsert({
      tenantId: tenant.id,
      callbackId: 'callback-orders',
      name: 'Order callbacks',
      destinations: []
    });

    let recorded = await signalClient.callback.recordEvent({
      tenantId: tenant.id,
      callbackId: 'callback-orders',
      status: 'failed',
      eventType: 'order.finished',
      inputJson,
      outputJson,
      errorCode: 'callback_failed',
      errorMessage: 'Callback failed'
    });

    expect(recorded).toMatchObject({
      callbackId: 'callback-orders',
      type: 'order.finished',
      input: { stage: 'input', ok: true },
      output: { stage: 'output', ok: true }
    });

    let inlineRecord = await testDb.callbackEvent.findUniqueOrThrow({
      where: { id: recorded.id }
    });

    expect(inlineRecord.inputJson).toBe(inputJson);
    expect(inlineRecord.outputJson).toBe(outputJson);
    expect(inlineRecord.inputStorageKey).toBeNull();
    expect(inlineRecord.outputStorageKey).toBeNull();

    await storage.putObject(
      env.storage.LOGS_BUCKET_NAME,
      storageKey.callbackEventInput(inlineRecord),
      inputJson
    );
    await storage.putObject(
      env.storage.LOGS_BUCKET_NAME,
      storageKey.callbackEventOutput(inlineRecord),
      outputJson
    );
    await testDb.callbackEvent.update({
      where: { id: recorded.id },
      data: {
        inputJson: null,
        inputStorageKey: storageKey.callbackEventInput(inlineRecord),
        outputJson: null,
        outputStorageKey: storageKey.callbackEventOutput(inlineRecord)
      }
    });

    let offloadedRecord = await testDb.callbackEvent.findUniqueOrThrow({
      where: { id: recorded.id }
    });

    expect(offloadedRecord.inputJson).toBeNull();
    expect(offloadedRecord.outputJson).toBeNull();
    expect(offloadedRecord.inputStorageKey).toBe(
      storageKey.callbackEventInput(offloadedRecord)
    );
    expect(offloadedRecord.outputStorageKey).toBe(
      storageKey.callbackEventOutput(offloadedRecord)
    );

    let storedInput = await storage.getObject(
      env.storage.LOGS_BUCKET_NAME,
      storageKey.callbackEventInput(offloadedRecord)
    );
    let storedOutput = await storage.getObject(
      env.storage.LOGS_BUCKET_NAME,
      storageKey.callbackEventOutput(offloadedRecord)
    );

    expect(storedInput.data.toString('utf-8')).toBe(inputJson);
    expect(storedOutput.data.toString('utf-8')).toBe(outputJson);

    let fetched = await signalClient.callback.getEvent({
      tenantId: tenant.id,
      callbackId: 'callback-orders',
      callbackEventId: recorded.id
    });

    expect(fetched).toMatchObject({
      id: recorded.id,
      input: { stage: 'input', ok: true },
      output: { stage: 'output', ok: true }
    });

    let listed = await signalClient.callback.listEvents({
      tenantId: tenant.id,
      callbackId: 'callback-orders',
      limit: 10
    });

    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).toMatchObject({
      id: recorded.id,
      input: null,
      output: null
    });
    expect(listed.pagination).toMatchObject({
      has_more_after: false,
      has_more_before: false
    });
  });
});
