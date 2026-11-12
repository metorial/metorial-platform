import type { NormalizedRecord } from '@metorial/groundstation-spec';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Tenant } from '../../../prisma/generated/client';
import type { IngestPrincipal } from '../../auth/principal';
import { createTenantKeyDeriver } from '../../crypto/keys';
import { createIngestFetch } from '../../ingest';
import { eraseTenantRecordsProcessor } from '../../queues/eraseRecords';
import type { RecordDraft } from '../../records/draft';
import { createRuntime, setRuntime } from '../../runtime';
import { tenantService } from '../../services/tenant';
import { createMongoSink, type MongoWriteStats } from '../../sink/mongo';
import { defaultStoragePolicy, type RecordBatch } from '../../sink/types';
import { buildDraft, unitPrincipal } from '../../test/build';
import { eventually, expectServiceError } from '../../test/helpers';
import { testPrincipal } from '../../test/pipeline';
import { createStore, getStore } from '../connection';
import { contentAad, createContentCipher } from '../contentCipher';
import { writeDocuments } from '../writer';

let sentinel = 'SENTINEL-c0ffee';
let millisPerDay = 86_400_000;

let store = getStore();
let cipher = createContentCipher('integration-content-secret');

let principalFor = (tenantId: string): IngestPrincipal => {
  let principal = unitPrincipal({ contentPolicy: { defaultMode: 'full' } });

  return { ...principal, tenant: { ...principal.tenant, id: tenantId } };
};

let record = (overrides: Partial<RecordDraft> = {}, tenantId = 'gst_store_a') =>
  buildDraft(
    {
      kind: 'event',
      type: 'prompt.submitted',
      identity: 'identity-1',
      client: { family: 'claude-code' },
      content: [{ role: 'prompt', value: `fix ${sentinel}` }],
      ...overrides
    },
    { principal: principalFor(tenantId), observedAt: new Date() }
  );

let batch = (
  records: NormalizedRecord[],
  overrides: Partial<RecordBatch> = {}
): RecordBatch => ({
  lane: 'live',
  tenantId: records[0]?.ingest.tenant_id ?? 'gst_store_a',
  storage: defaultStoragePolicy,
  records,
  ...overrides
});

let mongoSink = () => {
  let stats: MongoWriteStats[] = [];
  let sink = createMongoSink({ store, cipher, onWrite: s => stats.push(s) });

  return { sink, stats };
};

let hookPipeline = (contentMode: 'basic' | 'full') => {
  let { sink, stats } = mongoSink();

  let runtime = createRuntime({ sink, keys: createTenantKeyDeriver('test-hash-secret') });
  let principal = testPrincipal({ contentPolicy: { defaultMode: contentMode } });
  let fetch = createIngestFetch(async () => principal);

  let send = (body: unknown) => {
    setRuntime(runtime);

    return fetch(
      new Request('http://localhost/v1/ingest/hooks/claude-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
        body: JSON.stringify(body)
      })
    );
  };

  return { send, stats, principal };
};

let promptHook = {
  session_id: 'session-1',
  hook_event_name: 'UserPromptSubmit',
  prompt: `please fix ${sentinel}`
};

let allDocuments = async () => {
  let collections = store.collections();

  return [
    ...(await collections.events.find({}).toArray()),
    ...(await collections.measurements.find({}).toArray()),
    ...(await collections.contentTexts.find({}).toArray())
  ];
};

let countFor = async (tenantId: string) => {
  let collections = store.collections();

  let counts = await Promise.all([
    collections.events.countDocuments({ tenantId }),
    collections.measurements.countDocuments({ tenantId }),
    collections.contentTexts.countDocuments({ tenantId })
  ]);

  return counts.reduce((sum, count) => sum + count, 0);
};

beforeAll(async () => {
  await store.ready();
});

beforeEach(async () => {
  let collections = store.collections();

  await Promise.all([
    collections.events.deleteMany({}),
    collections.measurements.deleteMany({}),
    collections.contentTexts.deleteMany({})
  ]);
});

afterAll(async () => {
  setRuntime(undefined);
  await store.close();
});

describe('record store', () => {
  it('creates the TTL and lookup indexes', async () => {
    let collections = store.collections();

    let events = await collections.events.indexes();
    let texts = await collections.contentTexts.indexes();
    let measurements = await collections.measurements.indexes();

    for (let indexes of [events, texts, measurements]) {
      expect(indexes).toContainEqual(
        expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 })
      );
    }

    expect(events).toContainEqual(
      expect.objectContaining({
        key: { tenantId: 1, 'ctx.sessionKey': 1, occurredAt: 1 },
        partialFilterExpression: { 'ctx.sessionKey': { $exists: true } }
      })
    );
    expect(events).toContainEqual(
      expect.objectContaining({ key: { tenantId: 1, 'source.factKey': 1 } })
    );
  });

  it('stores a hook record with its text encrypted beside it in full mode', async () => {
    let pipeline = hookPipeline('full');

    let response = await pipeline.send(promptHook);
    expect(response.status).toBe(200);

    let collections = store.collections();
    let [event] = await collections.events.find({}).toArray();
    let [text] = await collections.contentTexts.find({}).toArray();

    expect(event).toMatchObject({
      tenantId: pipeline.principal.tenant.id,
      type: 'prompt.submitted',
      source: { adapter: 'claude-code', signalName: 'UserPromptSubmit' },
      ctx: { sessionId: 'session-1', sessionKey: expect.stringMatching(/^[0-9a-f]{32}$/) },
      content: [expect.objectContaining({ role: 'prompt', mode: 'full', hasText: true })]
    });
    expect(event!.expiresAt.getTime() - event!.occurredAt.getTime()).toBe(90 * millisPerDay);
    expect(JSON.stringify(event)).not.toContain(sentinel);

    expect(text).toMatchObject({
      _id: `${event!._id}:0`,
      recordId: event!._id,
      keyVersion: 1
    });
    expect(text!.expiresAt.getTime() - text!.occurredAt.getTime()).toBe(30 * millisPerDay);

    let key = cipher.forTenant({ id: pipeline.principal.tenant.id, contentKeyVersion: 1 });
    let aad = contentAad({
      tenantId: pipeline.principal.tenant.id,
      recordId: event!._id,
      index: 0,
      role: 'prompt'
    });

    expect(
      cipher.decrypt(
        key,
        { iv: Buffer.from(text!.iv.buffer), ciphertext: Buffer.from(text!.ciphertext.buffer) },
        aad
      )
    ).toBe(`please fix ${sentinel}`);
  });

  it('stores no text at all in basic mode', async () => {
    let pipeline = hookPipeline('basic');

    await pipeline.send(promptHook);

    let documents = await allDocuments();

    expect(documents).toHaveLength(1);
    expect(await store.collections().contentTexts.countDocuments()).toBe(0);
    expect(JSON.stringify(documents)).not.toContain(sentinel);
  });

  it('treats a repeated write as already stored', async () => {
    let { sink, stats } = mongoSink();
    let records = [record(), record({ identity: 'identity-2' })];

    await sink.write(batch(records));
    await sink.write(batch(records));

    expect(await store.collections().events.countDocuments()).toBe(2);
    expect(await store.collections().contentTexts.countDocuments()).toBe(2);
    expect(stats[1]!.events).toEqual({ inserted: 0, duplicates: 2, rejections: [] });
    expect(stats[1]!.contentTexts).toEqual({ inserted: 0, duplicates: 2, rejections: [] });
  });

  it('stores measurements with decimal costs and dated windows', async () => {
    let { sink } = mongoSink();
    let start = new Date(Date.now() - 30_000);
    let end = new Date();

    let measurement = buildDraft(
      {
        kind: 'measurement',
        type: 'cost',
        identity: 'measurement-1',
        client: { family: 'claude-code' },
        data: {
          name: 'cost',
          value: 0.25,
          cost: { amount: '0.250000', unit: 'usd', basis: 'reported' },
          window: { start: start.toISOString(), end: end.toISOString() }
        }
      },
      { principal: principalFor('gst_store_a'), observedAt: new Date() },
      { adapter: 'a', dialect: 'd', channel: 'otlp.metrics' }
    );

    await sink.write(batch([measurement]));

    let [stored] = await store.collections().measurements.find({}).toArray();
    let data = stored!.data as {
      cost: { amount: unknown };
      window: { start: unknown; end: unknown };
    };

    expect(data.cost.amount).toBeInstanceOf(mongoose.mongo.Decimal128);
    expect(String(data.cost.amount)).toBe('0.250000');
    expect(data.window).toEqual({ start, end });
  });

  it('skips records already past retention', async () => {
    let { sink, stats } = mongoSink();

    await sink.write(
      batch([record()], { storage: { ...defaultStoragePolicy, recordRetentionDays: 0 } })
    );

    expect(stats[0]!.expired).toBe(1);
    expect(await allDocuments()).toEqual([]);
  });

  it('drops documents the server rejects and keeps the rest of the chunk', async () => {
    let client = new mongoose.mongo.MongoClient(process.env.GROUNDSTATION_MONGO_URL!);
    await client.connect();

    try {
      let db = client.db();
      await db
        .collection('writer_validation')
        .drop()
        .catch(() => {});
      await db.createCollection('writer_validation', {
        validator: { $jsonSchema: { required: ['tenantId'] } }
      });

      let collection = db.collection<{ _id: string; tenantId?: string }>('writer_validation');
      await collection.insertOne({ _id: 'a', tenantId: 't' });

      let result = await writeDocuments(collection, [
        { _id: 'a', tenantId: 't' },
        { _id: 'b' },
        { _id: 'c', tenantId: 't' }
      ]);

      expect(result).toEqual({
        inserted: 1,
        duplicates: 1,
        rejections: [{ id: 'b', code: 121, message: expect.any(String) }]
      });
      expect(await collection.countDocuments()).toBe(2);

      await collection.drop();
    } finally {
      await client.close();
    }
  });

  it('answers sink_busy when the store is unreachable', async () => {
    let unreachable = createStore('mongodb://127.0.0.1:1/unreachable');
    let sink = createMongoSink({ store: unreachable, cipher, onWrite: () => {} });

    await expectServiceError(sink.write(batch([record()])), 'sink_busy');
    await unreachable.close();
  }, 20_000);

  it('erases every record of one tenant', async () => {
    let { sink } = mongoSink();

    await sink.write(
      batch([record({}, 'gst_store_a'), record({ identity: 'x' }, 'gst_store_a')])
    );
    await sink.write(batch([record({}, 'gst_store_b')]));

    expect(await countFor('gst_store_a')).toBe(4);

    let worker = await eraseTenantRecordsProcessor.start();

    try {
      await tenantService.eraseRecords({ tenant: { id: 'gst_store_a' } as Tenant });

      await eventually(async () => expect(await countFor('gst_store_a')).toBe(0), 10_000);
      expect(await countFor('gst_store_b')).toBe(2);
    } finally {
      await worker?.close();
    }
  }, 20_000);
});
