import { Hash } from '@lowerdeck/hash';
import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../env';
import { storageKey } from '../../lib/storageKey';
import { offloadCallbackEventPayloadQueueProcessor } from '../../queues/send/callbackEventPayload';
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

    await (offloadCallbackEventPayloadQueueProcessor as any).handler({
      callbackEventId: recorded.id,
      payloadType: 'input',
      payloadHash: await Hash.sha256(inputJson)
    });

    await (offloadCallbackEventPayloadQueueProcessor as any).handler({
      callbackEventId: recorded.id,
      payloadType: 'output',
      payloadHash: await Hash.sha256(outputJson)
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
  });
});
