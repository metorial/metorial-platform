import mongoose from 'mongoose';
import {
  createStore,
  setStoreIndexMode,
  writeDocuments,
  type Store
} from '@mtsrc/agent-tracking-store';
import type { SeedMarker } from './seed';

export let markerId = 'seed';

let markerCollectionName = 'agent_tracking_bench';

let deleteChunk = 5_000;

let insertChunk = 1_000;

let insertAttempts = 4;

let insertRetryPauseMs = 5_000;

export let organizationCollections = [
  'events',
  'measurements',
  'contentTexts',
  'sessions',
  'usageSlices',
  'sourceHealth'
] as const;

let markersOf = (store: Store) => {
  let db = store.sessions.db.db;
  if (!db) throw new Error('The bench store is not connected.');

  return db.collection<SeedMarker>(markerCollectionName);
};

export let saveMarker = (store: Store, marker: SeedMarker) =>
  markersOf(store).replaceOne({ _id: markerId }, marker, { upsert: true });

export let deleteMarker = (store: Store) => markersOf(store).deleteOne({ _id: markerId });

let isBusy = (error: unknown) =>
  (error as { data?: { code?: unknown } } | null)?.data?.code == 'sink_busy';

// A loaded store answers a chunk write with a timeout, which the writer reports as busy. Inserts
// are idempotent by id, so a busy chunk is written again after a pause, a few times at most.
export let insertAll = async <T extends { _id: string }>(
  collection: Parameters<typeof writeDocuments<T>>[0],
  documents: T[],
  pauseMs = insertRetryPauseMs
) => {
  let inserted = 0;

  for (let start = 0; start < documents.length; start += insertChunk) {
    let chunk = documents.slice(start, start + insertChunk);

    for (let attempt = 1; ; attempt++) {
      try {
        let result = await writeDocuments(collection, chunk);
        let rejected = result.rejections[0];
        if (rejected) {
          throw new Error(
            `The store rejected ${result.rejections.length} bench documents: ${rejected.message}`
          );
        }

        inserted += result.inserted;
        break;
      } catch (error) {
        if (attempt >= insertAttempts || !isBusy(error)) throw error;
        await new Promise(resolve => setTimeout(resolve, pauseMs * attempt));
      }
    }
  }

  return inserted;
};

export let deleteWhere = async (
  collection: mongoose.mongo.Collection<any>,
  filter: Record<string, unknown>
) => {
  let deleted = 0;

  while (true) {
    let ids = await collection
      .find(filter, { projection: { _id: 1 }, limit: deleteChunk })
      .toArray();
    if (!ids.length) return deleted;

    let result = await collection.deleteMany({ _id: { $in: ids.map(item => item._id) } });
    deleted += result.deletedCount;
  }
};

// Opening must leave the database as it was, so the check can run first: indexes are built by
// seed after the check, and models do not create their collections.
export let openBenchStore = async (url: string) => {
  setStoreIndexMode('skip');
  mongoose.set('autoCreate', false);

  let store = createStore(url);
  await store.ready();

  return store;
};

type StoreCheck = { requireMarker: boolean; requireComplete?: boolean };

export let assertBenchMarker = (marker: SeedMarker | null, check: StoreCheck) => {
  if (check.requireMarker && !marker) {
    throw new Error(
      'This database carries no bench marker; run seed first, and only on a bench database.'
    );
  }
  if (check.requireComplete && marker?.status != 'complete') {
    throw new Error('The bench seed has not completed; run seed again to resume it.');
  }
};

export let foreignDataFilters = (marker: SeedMarker | null) => {
  let organizationIds = [
    ...(marker?.organizations.map(org => org.organizationId) ?? []),
    ...(marker?.canary ? [marker.canary.organizationId] : [])
  ];
  let instanceIds = [
    ...(marker?.organizations.flatMap(org => org.instanceIds) ?? []),
    ...(marker?.canary?.instanceIds ?? [])
  ];

  return [
    ...organizationCollections.map(collection => ({
      collection,
      filter: organizationIds.length ? { organizationId: { $nin: organizationIds } } : {}
    })),
    {
      collection: 'sessionLinks' as const,
      filter: instanceIds.length ? { instanceId: { $nin: instanceIds } } : {}
    }
  ];
};

// The only way a command gets a store it may write to: the marker must match what the command
// needs, and no collection may hold data the bench did not create.
let checkBenchStore = async (store: Store, check: StoreCheck) => {
  let marker = await markersOf(store).findOne({ _id: markerId });
  assertBenchMarker(marker, check);

  let collections = store.collections();
  let foreign: string[] = [];

  for (let { collection, filter } of foreignDataFilters(marker)) {
    let found = await collections[collection].findOne(filter as never, {
      projection: { _id: 1 }
    });
    if (found) foreign.push(collection);
  }

  if (foreign.length) {
    throw new Error(
      `The database holds data the bench did not create (in ${foreign.join(', ')}). Use an empty, bench-only database.`
    );
  }

  return marker;
};

export let withCheckedStore = async <T>(
  url: string,
  check: StoreCheck,
  run: (store: Store, marker: SeedMarker | null) => Promise<T>
) => {
  let store = await openBenchStore(url);

  try {
    let marker = await checkBenchStore(store, check);
    return await run(store, marker);
  } finally {
    await store.close();
  }
};
