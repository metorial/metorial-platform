import { ServiceError } from '@lowerdeck/error';
import mongoose from 'mongoose';
import { sinkBusyError } from '../sink/types';

let maxChunkDocuments = 1000;
let maxChunkBytes = 8 * 1024 * 1024;
let writeTimeoutMs = 5000;

let duplicateKeyCode = 11000;

let transientCodes = new Set([
  6, 7, 50, 89, 91, 112, 189, 262, 9001, 10107, 11600, 11602, 13435, 13436, 16500
]);

export type WriteRejection = { id: string; code: number; message: string };

export type WriteResult = {
  inserted: number;
  duplicates: number;
  rejections: WriteRejection[];
};

type InsertableCollection<T> = {
  insertMany: (
    documents: T[],
    options: { ordered: false; timeoutMS: number }
  ) => Promise<{ insertedCount: number }>;
};

let isTransientError = (error: unknown): boolean => {
  let mongo = mongoose.mongo;

  if (
    error instanceof mongo.MongoNetworkError ||
    error instanceof mongo.MongoServerSelectionError ||
    error instanceof mongo.MongoOperationTimeoutError ||
    error instanceof mongo.MongoNotConnectedError
  ) {
    return true;
  }

  if (error instanceof mongo.MongoServerError) {
    return (
      transientCodes.has(Number(error.code)) ||
      error.hasErrorLabel('RetryableWriteError') ||
      error.hasErrorLabel('TransientTransactionError')
    );
  }

  return false;
};

let busy = (cause: unknown) => {
  console.warn('Groundstation store write failed transiently', cause);

  return new ServiceError(sinkBusyError());
};

export let chunkDocuments = <T>(
  documents: T[],
  sizeOf: (document: T) => number = () => 0
): T[][] => {
  let chunks: T[][] = [];
  let current: T[] = [];
  let currentBytes = 0;

  for (let document of documents) {
    let size = sizeOf(document);

    if (
      current.length > 0 &&
      (current.length >= maxChunkDocuments || currentBytes + size > maxChunkBytes)
    ) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(document);
    currentBytes += size;
  }

  if (current.length) chunks.push(current);

  return chunks;
};

let insertChunk = async <T extends { _id: string }>(
  collection: InsertableCollection<T>,
  documents: T[]
): Promise<WriteResult> => {
  try {
    let result = await collection.insertMany(documents, {
      ordered: false,
      timeoutMS: writeTimeoutMs
    });

    return { inserted: result.insertedCount, duplicates: 0, rejections: [] };
  } catch (error) {
    if (!(error instanceof mongoose.mongo.MongoBulkWriteError)) {
      if (isTransientError(error)) throw busy(error);
      throw error;
    }

    let writeErrors = ([] as mongoose.mongo.WriteError[]).concat(error.writeErrors ?? []);

    // The driver also wraps network failures and timeouts in a bulk error with no write errors,
    // so only per-document write errors count as an answer from the server. Retrying the whole
    // chunk is safe because record ids make inserts idempotent.
    if (!writeErrors.length || error.result?.getWriteConcernError()) throw busy(error);

    let duplicates = 0;
    let rejections: WriteRejection[] = [];

    for (let writeError of writeErrors) {
      if (writeError.code == duplicateKeyCode) {
        duplicates++;
        continue;
      }

      if (transientCodes.has(writeError.code)) throw busy(error);

      rejections.push({
        id: documents[writeError.index]?._id ?? 'unknown',
        code: writeError.code,
        message: writeError.errmsg ?? 'write rejected'
      });
    }

    return { inserted: error.insertedCount, duplicates, rejections };
  }
};

export let writeDocuments = async <T extends { _id: string }>(
  collection: InsertableCollection<T>,
  documents: T[],
  sizeOf?: (document: T) => number
): Promise<WriteResult> => {
  let total: WriteResult = { inserted: 0, duplicates: 0, rejections: [] };

  for (let chunk of chunkDocuments(documents, sizeOf)) {
    let result = await insertChunk(collection, chunk);

    total.inserted += result.inserted;
    total.duplicates += result.duplicates;
    total.rejections.push(...result.rejections);
  }

  return total;
};
