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

let serverSelectionTimeoutMs = 5000;
let poolHeadroom = 4;

export type StoreCollections = {
  events: mongoose.mongo.Collection<RecordDocument>;
  measurements: mongoose.mongo.Collection<RecordDocument>;
  contentTexts: mongoose.mongo.Collection<ContentTextDocument>;
};

export type Store = {
  events: mongoose.Model<RecordDocument>;
  measurements: mongoose.Model<RecordDocument>;
  contentTexts: mongoose.Model<ContentTextDocument>;

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
      contentTexts.createIndexes()
    ]);
  };

  return {
    events,
    measurements,
    contentTexts,

    collections: () => {
      let db = connection.db;
      if (!db) throw new Error('The record store is not connected.');

      return {
        events: db.collection<RecordDocument>(collectionNames.events),
        measurements: db.collection<RecordDocument>(collectionNames.measurements),
        contentTexts: db.collection<ContentTextDocument>(collectionNames.contentTexts)
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
