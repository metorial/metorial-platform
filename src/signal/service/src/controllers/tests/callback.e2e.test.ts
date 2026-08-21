import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../queues/send/callbackEventPayload', () => ({
  offloadCallbackEventPayloadQueue: { addMany: vi.fn() }
}));
vi.mock('../../queues/send/init', () => ({
  newEventQueue: { add: vi.fn() }
}));
import { env } from '../../env';
import { storageKey } from '../../lib/storageKey';
import { storage } from '../../storage';
import { createTestSignalClient, signalClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';

describe('callback.e2e', () => {
  let f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
    await storage.upsertBucket(env.storage.LOGS_BUCKET_NAME);
  });

  it('records authenticated dashboard test events idempotently and tenant-scoped', async () => {
    let tenant = await f.tenant.default();
    let otherTenant = await f.tenant.withIdentifier('other-tenant');
    let serviceCredential = 'subspace-service-test-credential';
    env.internal.SUBSPACE_SERVICE_CREDENTIAL = serviceCredential;
    let internalClient = createTestSignalClient({
      headers: { 'x-metorial-signal-service-credential': serviceCredential }
    });

    await signalClient.callback.upsert({
      tenantId: tenant.id,
      callbackId: 'callback-dashboard-test',
      name: 'Dashboard test callback',
      destinations: []
    });
    let request = {
      tenantId: tenant.id,
      callbackId: 'callback-dashboard-test',
      eventId: 'dashboard_test:fixed-request-id',
      callbackInstanceId: 'cbi_dashboard_test',
      eventType: 'dashboard.test',
      payloadJson: JSON.stringify({ ok: true })
    };

    let first = await internalClient.callback.recordDashboardTestEvent(request);
    let duplicate = await internalClient.callback.recordDashboardTestEvent(request);
    expect(duplicate.id).toBe(first.id);
    expect(first).toMatchObject({
      callbackId: request.callbackId,
      callbackInstanceId: request.callbackInstanceId,
      type: request.eventType,
      sourceId: 'dashboard_test',
      triggerKey: 'dashboard_test'
    });
    expect(
      await testDb.callbackEvent.count({
        where: { externalId: request.eventId }
      })
    ).toBe(1);
    expect(await testDb.event.count()).toBe(1);

    await expect(
      internalClient.callback.recordDashboardTestEvent({
        ...request,
        tenantId: otherTenant.id
      })
    ).rejects.toThrow();
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
