import { uniqueId } from '@lowerdeck/testing-tools';
import { beforeAll, describe, expect, it } from 'vitest';
import { db as testDb } from '../src/db';
import { env } from '../src/env';
import { storageKey } from '../src/lib/storageKey';
import { storage } from '../src/storage';
import { signal as signalClient } from './client';
import { createTenant } from './fixtures';

describe('signal callback', () => {
  beforeAll(async () => {
    await storage.upsertBucket(env.storage.LOGS_BUCKET_NAME);
  });

  it('offloads callback event input and output payloads asynchronously', async () => {
    let tenant = await createTenant();
    let callbackId = uniqueId('callback');
    let inputJson = JSON.stringify({ stage: 'input', ok: true });
    let outputJson = JSON.stringify({ stage: 'output', ok: true });

    await signalClient.callback.upsert({
      tenantId: tenant.id,
      callbackId,
      name: 'Order callbacks',
      destinations: []
    });

    let recorded = await signalClient.callback.recordEvent({
      tenantId: tenant.id,
      callbackId,
      status: 'failed',
      eventType: 'order.finished',
      inputJson,
      outputJson,
      errorCode: 'callback_failed',
      errorMessage: 'Callback failed'
    });

    expect(recorded).toMatchObject({
      callbackId,
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
      callbackId,
      callbackEventId: recorded.id
    });

    expect(fetched).toMatchObject({
      id: recorded.id,
      input: { stage: 'input', ok: true },
      output: { stage: 'output', ok: true }
    });

    let listed = await signalClient.callback.listEvents({
      tenantId: tenant.id,
      callbackId,
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
