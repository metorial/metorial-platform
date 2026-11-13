import type { NormalizedRecord } from '@mtsrc/agent-tracking-spec';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';
import { createOrganizationKeyDeriver } from '@mtsrc/agent-tracking-crypto';
import { createIngestFetch } from '../../src';
import { recordsQueueProcessor } from '@mtsrc/agent-tracking-module-records';
import type { RecordDraft } from '@mtsrc/agent-tracking-records-model';
import { createRuntime, setRuntime } from '@mtsrc/agent-tracking-module-ingest';
import {
  instanceService,
  organizationService,
  projectService
} from '@mtsrc/agent-tracking-module-scope';
import { scopeErasureService } from '@mtsrc/agent-tracking-module-erasure';
import {
  createMongoSink,
  setRecordSink,
  type MongoWriteStats
} from '@mtsrc/agent-tracking-module-records';
import { defaultStoragePolicy, type RecordBatch } from '@mtsrc/agent-tracking-store';
import { buildDraft, unitPrincipal } from '@mtsrc/agent-tracking-dialects/test/build';
import { eventually, expectServiceError } from '@mtsrc/agent-tracking-testing';
import { testPrincipal } from '../pipeline';
import { createTestScope } from '@mtsrc/agent-tracking-module-scope/test/scope';
import { createStore, getStore } from '@mtsrc/agent-tracking-store';
import { contentAad, createContentCipher } from '@mtsrc/agent-tracking-crypto';
import { writeDocuments } from '@mtsrc/agent-tracking-store';

let sentinel = 'SENTINEL-c0ffee';
let millisPerDay = 86_400_000;

let store = getStore();
let cipher = createContentCipher('integration-content-secret');

type Scope = { organizationId: string; projectId: string; instanceId: string };

let defaultScope: Scope = {
  organizationId: 'ator_store_a',
  projectId: 'atpr_store_a',
  instanceId: 'atin_store_a'
};

let principalFor = (scope: Scope): IngestPrincipal =>
  unitPrincipal({
    contentPolicy: { defaultMode: 'full' },
    organization: { id: scope.organizationId },
    project: { id: scope.projectId },
    instance: { id: scope.instanceId }
  });

let record = (overrides: Partial<RecordDraft> = {}, scope: Scope = defaultScope) =>
  buildDraft(
    {
      kind: 'event',
      type: 'prompt.submitted',
      identity: 'identity-1',
      client: { family: 'claude-code' },
      content: [{ role: 'prompt', value: `fix ${sentinel}` }],
      ...overrides
    },
    { principal: principalFor(scope), observedAt: new Date() }
  );

let batch = (
  records: NormalizedRecord[],
  overrides: Partial<RecordBatch> = {}
): RecordBatch => ({
  lane: 'live',
  organizationId: records[0]?.ingest.organization_id ?? defaultScope.organizationId,
  projectId: records[0]?.ingest.project_id ?? defaultScope.projectId,
  instanceId: records[0]?.ingest.instance_id ?? defaultScope.instanceId,
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

  let runtime = createRuntime({
    keys: createOrganizationKeyDeriver('test-hash-secret'),
    stages: []
  });
  let principal = testPrincipal({ contentPolicy: { defaultMode: contentMode } });
  let fetch = createIngestFetch(async () => principal);

  let send = (body: unknown) => {
    setRuntime(runtime);
    setRecordSink(sink);

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

let countFor = async (instanceId: string) => {
  let collections = store.collections();

  let counts = await Promise.all(
    Object.values(collections).map(collection =>
      (collection as typeof collections.events).countDocuments({ instanceId })
    )
  );

  return counts.reduce((sum, count) => sum + count, 0);
};

let insertDerived = async (scope: Scope) => {
  let collections = store.collections();
  let _id = `${scope.instanceId}:${crypto.randomUUID()}`;

  await collections.sessions.insertOne({ _id, ...scope } as never);
  await collections.sessionLinks.insertOne({ _id, instanceId: scope.instanceId } as never);
  await collections.usageSlices.insertOne({ _id, ...scope } as never);
  await collections.sourceHealth.insertOne({
    _id,
    organizationId: scope.organizationId,
    instanceId: scope.instanceId
  } as never);
};

let writeScope = async (scope: Scope) => {
  let { sink } = mongoSink();

  await sink.write(
    batch([record({}, scope), record({ identity: `${scope.instanceId}-2` }, scope)])
  );
  await insertDerived(scope);
};

let scopeIds = (scope: Awaited<ReturnType<typeof createTestScope>>): Scope => ({
  organizationId: scope.organization.id,
  projectId: scope.project.id,
  instanceId: scope.instance.id
});

beforeAll(async () => {
  await store.ready();
});

beforeEach(async () => {
  let collections = store.collections();

  await Promise.all(
    Object.values(collections).map(collection =>
      (collection as typeof collections.events).deleteMany({})
    )
  );
});

afterAll(async () => {
  setRuntime(undefined);
  setRecordSink(undefined);
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
        key: { organizationId: 1, 'ctx.sessionKey': 1, occurredAt: 1 },
        partialFilterExpression: { 'ctx.sessionKey': { $exists: true } }
      })
    );
    expect(events).toContainEqual(
      expect.objectContaining({ key: { organizationId: 1, 'source.factKey': 1 } })
    );
    expect(events).toContainEqual(
      expect.objectContaining({ key: { organizationId: 1, instanceId: 1, occurredAt: -1 } })
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        key: { organizationId: 1, 'attribution.userId': 1, occurredAt: -1 },
        partialFilterExpression: { 'attribution.userId': { $exists: true } }
      })
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
      organizationId: pipeline.principal.organization.id,
      projectId: pipeline.principal.project.id,
      instanceId: pipeline.principal.instance.id,
      ingest: { credentialKind: 'token', credentialId: pipeline.principal.credential.id },
      type: 'prompt.submitted',
      source: { adapter: 'claude-code', signalName: 'UserPromptSubmit' },
      ctx: { sessionId: 'session-1', sessionKey: expect.stringMatching(/^[0-9a-f]{32}$/) },
      content: [expect.objectContaining({ role: 'prompt', mode: 'full', hasText: true })]
    });
    expect(event!.expiresAt.getTime() - event!.occurredAt.getTime()).toBe(90 * millisPerDay);
    expect(JSON.stringify(event)).not.toContain(sentinel);

    expect(text).toMatchObject({
      _id: `${event!._id}:0`,
      organizationId: pipeline.principal.organization.id,
      instanceId: pipeline.principal.instance.id,
      recordId: event!._id,
      keyVersion: 1
    });
    expect(text!.expiresAt.getTime() - text!.occurredAt.getTime()).toBe(30 * millisPerDay);

    let key = cipher.forOrganization({
      id: pipeline.principal.organization.id,
      contentKeyVersion: 1
    });
    let aad = contentAad({
      organizationId: pipeline.principal.organization.id,
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
      { principal: principalFor(defaultScope), observedAt: new Date() },
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
    let client = new mongoose.mongo.MongoClient(process.env.AGENT_TRACKING_MONGO_URL!);
    await client.connect();

    try {
      let db = client.db();
      await db
        .collection('writer_validation')
        .drop()
        .catch(() => {});
      await db.createCollection('writer_validation', {
        validator: { $jsonSchema: { required: ['organizationId'] } }
      });

      let collection = db.collection<{ _id: string; organizationId?: string }>(
        'writer_validation'
      );
      await collection.insertOne({ _id: 'a', organizationId: 't' });

      let result = await writeDocuments(collection, [
        { _id: 'a', organizationId: 't' },
        { _id: 'b' },
        { _id: 'c', organizationId: 't' }
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

  it('erases every record, session and slice of one organization', async () => {
    let first = await createTestScope();
    let sibling = await createTestScope({ organizationRef: first.organization.ref });
    let other = await createTestScope();

    await writeScope(scopeIds(first));
    await writeScope(scopeIds(sibling));
    await writeScope(scopeIds(other));

    expect(await countFor(first.instance.id)).toBe(8);

    let worker = await recordsQueueProcessor.start();

    try {
      await scopeErasureService.eraseOrganization({ organization: first.organization });

      await eventually(async () => {
        expect(await countFor(first.instance.id)).toBe(0);
        expect(await countFor(sibling.instance.id)).toBe(0);
      }, 10_000);
      expect(await countFor(other.instance.id)).toBe(8);
    } finally {
      await worker?.close();
    }
  }, 20_000);

  it('erases one project and keeps the other projects of the organization', async () => {
    let first = await createTestScope();
    let sibling = await createTestScope({ organizationRef: first.organization.ref });

    await writeScope(scopeIds(first));
    await writeScope(scopeIds(sibling));

    let worker = await recordsQueueProcessor.start();

    try {
      await scopeErasureService.eraseProject({
        organization: first.organization,
        project: first.project
      });

      await eventually(async () => expect(await countFor(first.instance.id)).toBe(0), 10_000);
      expect(await countFor(sibling.instance.id)).toBe(8);
    } finally {
      await worker?.close();
    }
  }, 20_000);

  it('erases one instance and keeps its siblings in the project', async () => {
    let first = await createTestScope();
    let sibling = await instanceService.upsertInstance({
      organization: first.organization,
      project: first.project,
      input: { ref: `inst_${crypto.randomUUID()}` }
    });
    let siblingScope = { ...scopeIds(first), instanceId: sibling.id };

    await writeScope(scopeIds(first));
    await writeScope(siblingScope);

    let worker = await recordsQueueProcessor.start();

    try {
      await scopeErasureService.eraseInstance({
        organization: first.organization,
        instance: first.instance
      });

      await eventually(async () => expect(await countFor(first.instance.id)).toBe(0), 10_000);
      expect(await countFor(sibling.id)).toBe(8);
    } finally {
      await worker?.close();
    }
  }, 20_000);
});
