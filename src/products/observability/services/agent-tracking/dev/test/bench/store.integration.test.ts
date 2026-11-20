import mongoose from 'mongoose';
import { afterAll, describe, expect, it } from 'vitest';
import type { AgentTrackingClient } from '@mtsrc/agent-tracking-api-internal';
import { integrationTestEnv } from '@mtsrc/agent-tracking-testing/config';
import { cleanupStore, seedStore, type SeedMarker } from '../../src/bench/seed';
import { resolveSeedShape, smokeSeedShape } from '../../src/bench/shape';
import { openBenchStore, withCheckedStore } from '../../src/bench/store';
import { defaultTrafficProfile } from '../../src/load/profile';
import { sampleStoreSizes } from '../../src/sizing/storeSample';

let baseUrl = new URL(integrationTestEnv.AGENT_TRACKING_MONGO_URL);

let client = new mongoose.mongo.MongoClient(baseUrl.toString(), {
  serverSelectionTimeoutMS: 1_500
});

let reachable = await client
  .connect()
  .then(() => client.db().command({ ping: 1 }))
  .then(
    () => true,
    () => false
  );

let databases: string[] = [];

let freshDatabase = () => {
  let name = `at_dev_bench_${process.pid}_${databases.length}`;
  databases.push(name);

  let url = new URL(baseUrl);
  url.pathname = `/${name}`;

  return { db: client.db(name), url: url.toString() };
};

let contents = async (db: mongoose.mongo.Db) => {
  let collections = (await db.listCollections().toArray()).map(item => item.name).sort();

  return Object.fromEntries(
    await Promise.all(
      collections.map(async name => [
        name,
        {
          documents: await db.collection(name).find().sort({ _id: 1 }).toArray(),
          indexes: (await db.collection(name).indexes()).map(index => index.name).sort()
        }
      ])
    )
  );
};

let erased: string[] = [];

let stubClient = {
  organization: {
    erase: async (input: { organizationId: string }) => {
      erased.push(input.organizationId);
      return {};
    }
  }
} as unknown as AgentTrackingClient;

afterAll(async () => {
  if (reachable) for (let name of databases) await client.db(name).dropDatabase();
  await client.close();
});

describe.skipIf(!reachable)('bench store against MongoDB', () => {
  it('refuses to seed a database holding foreign data and writes nothing', async () => {
    let { db, url } = freshDatabase();
    await db
      .collection('events')
      .insertOne({ _id: 'real' as never, organizationId: 'ator_customer' });
    let before = await contents(db);

    await expect(
      withCheckedStore(url, { requireMarker: false }, (store, marker) =>
        seedStore({
          store,
          marker,
          client: stubClient,
          shape: resolveSeedShape(smokeSeedShape),
          profile: defaultTrafficProfile,
          seed: 1,
          log: () => {}
        })
      )
    ).rejects.toThrow(/did not create \(in events\)/);

    expect(await contents(db)).toEqual(before);
  });

  it('cleans up only the bench documents and the marker', async () => {
    let { db, url } = freshDatabase();
    let anchor = new Date('2026-11-18T12:00:00Z');
    let marker: SeedMarker = {
      _id: 'seed',
      createdAt: anchor,
      updatedAt: anchor,
      status: 'complete',
      seed: 1,
      anchor,
      shape: resolveSeedShape(smokeSeedShape),
      organizations: [
        {
          index: 0,
          ref: 'atbench-org-1-0',
          organizationId: 'ator_bench',
          projectId: 'atpr_bench',
          instanceIds: ['atin_bench'],
          userIds: [],
          anchor,
          nextDay: 40
        }
      ],
      written: { sessions: 1, slices: 0, events: 1 }
    };

    await db.collection<SeedMarker>('agent_tracking_bench').insertOne(marker);
    await db
      .collection('events')
      .insertOne({ _id: 'e1' as never, organizationId: 'ator_bench' });
    await db
      .collection('sessions')
      .insertOne({ _id: 's1' as never, organizationId: 'ator_bench' });
    await db
      .collection('session_links')
      .insertOne({ _id: 'l1' as never, instanceId: 'atin_bench' });
    await db
      .collection('unrelated')
      .insertOne({ _id: 'keep' as never, organizationId: 'ator_bench' });

    erased = [];
    await withCheckedStore(url, { requireMarker: true }, (store, found) =>
      cleanupStore({
        store,
        marker: found!,
        client: stubClient,
        eraseOrganizations: true,
        log: () => {}
      })
    );

    let after = await contents(db);
    expect(after.unrelated?.documents).toEqual([
      { _id: 'keep', organizationId: 'ator_bench' }
    ]);
    for (let name of ['agent_tracking_bench', 'events', 'sessions', 'session_links']) {
      expect(after[name]?.documents, name).toEqual([]);
    }
    expect(erased).toEqual(['ator_bench']);
  });

  it('samples sizes without changing anything', async () => {
    let { db, url } = freshDatabase();
    let at = new Date(Date.now() - 5 * 86_400_000);

    await db.collection('sessions').insertOne({
      _id: 's1' as never,
      organizationId: 'ator_x',
      lastActivityAt: at
    });
    await db.collection('usage_slices').insertOne({
      _id: 'u1' as never,
      organizationId: 'ator_x',
      sessionKey: 's1'
    });
    await db.collection('events').insertOne({
      _id: 'e1' as never,
      organizationId: 'ator_x',
      type: 'model.request',
      ctx: { sessionKey: 's1' }
    });
    let before = await contents(db);

    let store = await openBenchStore(url);
    let sizes = await sampleStoreSizes({ store, sample: 100 }).finally(() => store.close());

    expect(sizes.sample.events).toBe(1);
    expect(sizes.recordsPerSession).toBe(1);
    expect(await contents(db)).toEqual(before);
  });
});
