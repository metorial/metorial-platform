import mongoose from 'mongoose';
import { env } from './env';
import {
  collectionNames,
  ConnectionCheckSchema,
  InferenceContentSchema,
  InferenceLogSchema,
  type ConnectionCheckDocument,
  type InferenceContentDocument,
  type InferenceLogDocument
} from './models';

let serverSelectionTimeoutMs = 5000;
let maxPoolSize = 20;

export type Store = {
  inferenceLogs: mongoose.Model<InferenceLogDocument>;
  inferenceContents: mongoose.Model<InferenceContentDocument>;
  connectionChecks: mongoose.Model<ConnectionCheckDocument>;

  ready: () => Promise<void>;
  close: () => Promise<void>;
};

export let createStore = (url: string): Store => {
  let connection = mongoose.createConnection();

  let inferenceLogs = connection.model<InferenceLogDocument>(
    'InferenceLog',
    InferenceLogSchema,
    collectionNames.inferenceLogs
  );
  let inferenceContents = connection.model<InferenceContentDocument>(
    'InferenceContent',
    InferenceContentSchema,
    collectionNames.inferenceContents
  );
  let connectionChecks = connection.model<ConnectionCheckDocument>(
    'ConnectionCheck',
    ConnectionCheckSchema,
    collectionNames.connectionChecks
  );

  let opening: Promise<void> | null = null;

  // DocumentDB has no retryable writes. Undefined fields are skipped rather than stored as null.
  let open = async () => {
    await connection.openUri(url, {
      bufferCommands: false,
      autoIndex: false,
      retryWrites: false,
      ignoreUndefined: true,
      serverSelectionTimeoutMS: serverSelectionTimeoutMs,
      maxPoolSize
    });

    await Promise.all([
      inferenceLogs.createIndexes(),
      inferenceContents.createIndexes(),
      connectionChecks.createIndexes()
    ]);
  };

  return {
    inferenceLogs,
    inferenceContents,
    connectionChecks,

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

export let isStoreConfigured = () => !!env.store.mongoUrl;

export let getStore = (): Store => {
  if (current) return current;

  let url = env.store.mongoUrl;
  if (!url) throw new Error('AI_GATEWAY_MONGO_URL is required for the inference log store.');

  current = createStore(url);

  return current;
};
