import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { expectServiceError } from '@mtsrc/agent-tracking-testing';
import { chunkDocuments, writeDocuments } from '../src/writer';

let mebibyte = 1024 * 1024;

let mongo = mongoose.mongo;

type Doc = { _id: string };

let docs = (count: number): Doc[] =>
  Array.from({ length: count }, (_, i) => ({ _id: `d${i}` }));

let bulkError = (
  writeErrors: { code: number; index: number; errmsg?: string }[],
  options: { insertedCount?: number; writeConcernError?: boolean } = {}
) =>
  new mongo.MongoBulkWriteError(
    {
      message: 'bulk failed',
      code: writeErrors[0]?.code ?? 64,
      writeErrors: writeErrors as unknown as mongoose.mongo.WriteError[]
    },
    {
      insertedCount: options.insertedCount ?? 0,
      getWriteConcernError: () => (options.writeConcernError ? { code: 64 } : undefined)
    } as unknown as mongoose.mongo.BulkWriteResult
  );

type InsertOptions = { ordered: false; timeoutMS: number };

let collection = (
  insertMany: (documents: Doc[], options: InsertOptions) => Promise<{ insertedCount: number }>
) => ({
  insertMany: vi.fn(insertMany)
});

describe('chunkDocuments', () => {
  it('splits by document count', () => {
    expect(chunkDocuments(docs(2500)).map(chunk => chunk.length)).toEqual([1000, 1000, 500]);
  });

  it('splits by size and keeps an oversized document on its own', () => {
    let sizes: Record<string, number> = { d0: 3, d1: 3, d2: 3, d3: 20, d4: 1 };

    let chunks = chunkDocuments(docs(5), doc => sizes[doc._id]! * mebibyte);

    expect(chunks.map(chunk => chunk.map(doc => doc._id))).toEqual([
      ['d0', 'd1'],
      ['d2'],
      ['d3'],
      ['d4']
    ]);
  });

  it('returns no chunks for no documents', () => {
    expect(chunkDocuments([])).toEqual([]);
  });
});

describe('writeDocuments', () => {
  it('inserts unordered with a timeout and sums chunk results', async () => {
    let target = collection(async documents => ({ insertedCount: documents.length }));

    let result = await writeDocuments(target, docs(1500));

    expect(result).toEqual({ inserted: 1500, duplicates: 0, rejections: [] });
    expect(target.insertMany).toHaveBeenCalledTimes(2);
    expect(target.insertMany.mock.calls[0]![1]).toEqual({ ordered: false, timeoutMS: 5000 });
  });

  it('counts duplicate keys as stored and reports rejected documents', async () => {
    let target = collection(async () => {
      throw bulkError(
        [
          { code: 11000, index: 0 },
          { code: 2, index: 2, errmsg: 'bad value' }
        ],
        { insertedCount: 1 }
      );
    });

    let result = await writeDocuments(target, docs(3));

    expect(result).toEqual({
      inserted: 1,
      duplicates: 1,
      rejections: [{ id: 'd2', code: 2, message: 'bad value' }]
    });
  });

  it('fails the write with sink_busy on a transient write error', async () => {
    let target = collection(async () => {
      throw bulkError([
        { code: 11000, index: 0 },
        { code: 91, index: 1 }
      ]);
    });

    await expectServiceError(writeDocuments(target, docs(2)), 'sink_busy');
  });

  it('fails the write with sink_busy when the bulk error carries no write errors', async () => {
    let target = collection(async () => {
      throw bulkError([]);
    });

    await expectServiceError(writeDocuments(target, docs(2)), 'sink_busy');
  });

  it('fails the write with sink_busy on a write concern error', async () => {
    let target = collection(async () => {
      throw bulkError([{ code: 11000, index: 0 }], { writeConcernError: true });
    });

    await expectServiceError(writeDocuments(target, docs(2)), 'sink_busy');
  });

  it.each([
    ['network', () => new mongo.MongoNetworkError('connection reset')],
    ['timeout', () => new mongo.MongoOperationTimeoutError('timed out')],
    ['not primary', () => new mongo.MongoServerError({ message: 'not primary', code: 10107 })]
  ])('fails the write with sink_busy on a %s error', async (_, error) => {
    let target = collection(async () => {
      throw error();
    });

    await expectServiceError(writeDocuments(target, docs(1)), 'sink_busy');
  });

  it('rethrows other errors', async () => {
    let failure = new mongo.MongoServerError({ message: 'unauthorized', code: 13 });
    let target = collection(async () => {
      throw failure;
    });

    await expect(writeDocuments(target, docs(1))).rejects.toBe(failure);
  });

  it('stops at the first chunk that fails transiently', async () => {
    let target = collection(async () => {
      throw new mongo.MongoNetworkError('down');
    });

    await expectServiceError(writeDocuments(target, docs(2500)), 'sink_busy');
    expect(target.insertMany).toHaveBeenCalledTimes(1);
  });
});
