import mongoose from 'mongoose';
import { env } from './env';
import { defaultLaneLimits } from './admission';
import { assertQueryEngineSupported } from './version';
import {
  createStoreUnreachableLog,
  reportStoreProblem,
  storeFailureReason,
  StoreUnreachableError
} from './unreachable';
import {
  collectionNames,
  ContentTextSchema,
  EventSchema,
  MeasurementSchema,
  type ContentTextDocument,
  type RecordDocument
} from './models';
import {
  derivedCollectionNames,
  SessionLinkSchema,
  SessionSchema,
  SourceHealthSchema,
  UsageSliceSchema,
  type SessionDocument,
  type SessionLinkDocument,
  type SourceHealthDocument,
  type UsageSliceDocument
} from './derivedModels';

let serverSelectionTimeoutMs = 5000;
let poolHeadroom = 4;

// `await` builds indexes before the store is ready, `background` after connecting, `skip`
// leaves them to the worker so role starts do not race.
export type StoreIndexMode = 'await' | 'background' | 'skip';

let indexMode: StoreIndexMode = 'await';

let indexBuildAttempts = 5;
let indexRetryBaseMs = 5_000;

let sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export let buildIndexesWithRetry = async (d: {
  build: () => Promise<void>;
  attempts?: number;
  baseDelayMs?: number;
  wait?: (ms: number) => Promise<unknown>;
  random?: () => number;
}) => {
  let attempts = d.attempts ?? indexBuildAttempts;
  let baseDelayMs = d.baseDelayMs ?? indexRetryBaseMs;
  let wait = d.wait ?? sleep;
  let random = d.random ?? Math.random;

  for (let attempt = 1; ; attempt++) {
    try {
      await d.build();
      return true;
    } catch (error) {
      if (attempt >= attempts) {
        console.error(
          `[agent-tracking] record store indexes are not in place after ${attempts} attempts`,
          error
        );
        reportStoreProblem({ problem: 'indexes_failed', attempts });
        return false;
      }

      console.warn(`[agent-tracking] record store index build failed, retrying`, error);
      await wait(baseDelayMs * 2 ** (attempt - 1) * (1 + random()));
    }
  }
};

export let setStoreIndexMode = (mode: StoreIndexMode) => {
  indexMode = mode;
};

export type StoreCollections = {
  events: mongoose.mongo.Collection<RecordDocument>;
  measurements: mongoose.mongo.Collection<RecordDocument>;
  contentTexts: mongoose.mongo.Collection<ContentTextDocument>;
  sessions: mongoose.mongo.Collection<SessionDocument>;
  sessionLinks: mongoose.mongo.Collection<SessionLinkDocument>;
  usageSlices: mongoose.mongo.Collection<UsageSliceDocument>;
  sourceHealth: mongoose.mongo.Collection<SourceHealthDocument>;
};

export type Store = {
  events: mongoose.Model<RecordDocument>;
  measurements: mongoose.Model<RecordDocument>;
  contentTexts: mongoose.Model<ContentTextDocument>;
  sessions: mongoose.Model<SessionDocument>;
  sessionLinks: mongoose.Model<SessionLinkDocument>;
  usageSlices: mongoose.Model<UsageSliceDocument>;
  sourceHealth: mongoose.Model<SourceHealthDocument>;

  collections: () => StoreCollections;
  assertQuerySupport: () => Promise<string>;

  hasConnected: () => boolean;
  logUnreachable: (error: unknown) => void;

  ensureIndexes: () => Promise<void>;
  ready: () => Promise<void>;
  close: () => Promise<void>;
};

export let createStore = (url: string): Store => {
  let connection = mongoose.createConnection();

  let events = connection.model<RecordDocument>('Event', EventSchema, collectionNames.events);
  let measurements = connection.model<RecordDocument>(
    'Measurement',
    MeasurementSchema,
    collectionNames.measurements
  );
  let contentTexts = connection.model<ContentTextDocument>(
    'ContentText',
    ContentTextSchema,
    collectionNames.contentTexts
  );
  let sessions = connection.model<SessionDocument>(
    'Session',
    SessionSchema,
    derivedCollectionNames.sessions
  );
  let sessionLinks = connection.model<SessionLinkDocument>(
    'SessionLink',
    SessionLinkSchema,
    derivedCollectionNames.sessionLinks
  );
  let usageSlices = connection.model<UsageSliceDocument>(
    'UsageSlice',
    UsageSliceSchema,
    derivedCollectionNames.usageSlices
  );
  let sourceHealth = connection.model<SourceHealthDocument>(
    'SourceHealth',
    SourceHealthSchema,
    derivedCollectionNames.sourceHealth
  );

  let opening: Promise<void> | null = null;
  let connected = false;
  let hasConnected = () => connected;
  let logUnreachable = createStoreUnreachableLog({ hasConnected });

  // DocumentDB has no retryable writes. Undefined fields are skipped rather than stored as null,
  // because the mapper leaves optional fields undefined instead of deleting them.
  let open = async () => {
    try {
      await connection.openUri(url, {
        bufferCommands: false,
        autoIndex: false,
        retryWrites: false,
        ignoreUndefined: true,
        serverSelectionTimeoutMS: serverSelectionTimeoutMs,
        maxPoolSize: defaultLaneLimits.live + defaultLaneLimits.backfill + poolHeadroom
      });
    } catch (error) {
      throw new StoreUnreachableError(storeFailureReason(error), error);
    }

    connected = true;

    if (indexMode == 'await') await ensureIndexes();
    if (indexMode == 'background') {
      void buildIndexesWithRetry({ build: ensureIndexes });
    }
  };

  let ensureIndexes = async () => {
    let models = [
      events,
      measurements,
      contentTexts,
      sessions,
      sessionLinks,
      usageSlices,
      sourceHealth
    ];
    let startedAt = Date.now();

    console.log('[agent-tracking] ensuring record store indexes');

    let results = await Promise.allSettled(models.map(model => model.createIndexes()));
    let failed = results.flatMap((result, index) =>
      result.status == 'rejected'
        ? [{ collection: models[index]!.collection.collectionName, error: result.reason }]
        : []
    );

    if (failed.length) {
      throw new Error(
        `Record store indexes failed on ${failed.map(item => item.collection).join(', ')}: ${failed.map(item => String(item.error)).join('; ')}`
      );
    }

    console.log(
      `[agent-tracking] record store indexes in place after ${Date.now() - startedAt} ms`
    );
  };

  return {
    events,
    measurements,
    contentTexts,
    sessions,
    sessionLinks,
    usageSlices,
    sourceHealth,

    collections: () => {
      let db = connection.db;
      if (!db) throw new Error('The record store is not connected.');

      return {
        events: db.collection<RecordDocument>(collectionNames.events),
        measurements: db.collection<RecordDocument>(collectionNames.measurements),
        contentTexts: db.collection<ContentTextDocument>(collectionNames.contentTexts),
        sessions: db.collection<SessionDocument>(derivedCollectionNames.sessions),
        sessionLinks: db.collection<SessionLinkDocument>(derivedCollectionNames.sessionLinks),
        usageSlices: db.collection<UsageSliceDocument>(derivedCollectionNames.usageSlices),
        sourceHealth: db.collection<SourceHealthDocument>(derivedCollectionNames.sourceHealth)
      };
    },

    hasConnected,
    logUnreachable,
    ensureIndexes,

    assertQuerySupport: () => {
      let db = connection.db;
      if (!db) throw new Error('The record store is not connected.');

      return assertQueryEngineSupported(db);
    },

    ready: () => {
      opening ??= open().catch(error => {
        opening = null;
        throw error;
      });

      return opening;
    },

    close: async () => {
      opening = null;
      await connection.close();
    }
  };
};

let current: Store | undefined;

export let isStoreConfigured = () => !!env.records.mongoUrl;

export let getStore = (): Store => {
  if (current) return current;

  let url = env.records.mongoUrl;
  if (!url) throw new Error('AGENT_TRACKING_MONGO_URL is required for the record store.');

  current = createStore(url);

  return current;
};
