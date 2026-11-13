import mongoose from 'mongoose';
import { env } from '../env';
import { defaultLaneLimits } from './admission';
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

  // DocumentDB has no retryable writes. Undefined fields are skipped rather than stored as null,
  // because the mapper leaves optional fields undefined instead of deleting them.
  let open = async () => {
    await connection.openUri(url, {
      bufferCommands: false,
      autoIndex: false,
      retryWrites: false,
      ignoreUndefined: true,
      serverSelectionTimeoutMS: serverSelectionTimeoutMs,
      maxPoolSize: defaultLaneLimits.live + defaultLaneLimits.backfill + poolHeadroom
    });

    await Promise.all([
      events.createIndexes(),
      measurements.createIndexes(),
      contentTexts.createIndexes(),
      sessions.createIndexes(),
      sessionLinks.createIndexes(),
      usageSlices.createIndexes(),
      sourceHealth.createIndexes()
    ]);
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
  if (!url) throw new Error('GROUNDSTATION_MONGO_URL is required for the record store.');

  current = createStore(url);

  return current;
};
