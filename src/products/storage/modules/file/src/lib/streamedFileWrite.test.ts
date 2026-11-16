import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  putObjectStream: vi.fn(),
  enqueueDelete: vi.fn(),
  addDelete: vi.fn(),
  inTransaction: false
}));

vi.mock('@metorial/db', () => ({
  isInTransaction: () => mocks.inTransaction
}));
vi.mock('../queues/objectDelete', () => ({
  cargoObjectDelete: {
    enqueue: mocks.enqueueDelete,
    queue: { add: mocks.addDelete }
  }
}));
vi.mock('../storage', () => ({
  getCargoFilesBucketName: () => 'cargo-files',
  putObjectStream: mocks.putObjectStream
}));

let {
  ByteStreamTooLargeError,
  createChunkedByteStream,
  readByteStreamHead,
  streamedUploadHeadBytes,
  writeStreamedFile
} = await import('./streamedFileWrite');

let chunksOf = async function* (sizes: number[]) {
  let value = 0;
  for (let size of sizes) {
    let chunk = new Uint8Array(size);
    for (let i = 0; i < size; i++) chunk[i] = value++ % 251;
    yield chunk;
  }
};

let expectedBytes = (size: number) => Uint8Array.from({ length: size }, (_, i) => i % 251);

let collect = async (stream: ReadableStream<Uint8Array>) => {
  let chunks: Uint8Array[] = [];
  for await (let chunk of stream as unknown as AsyncIterable<Uint8Array>) chunks.push(chunk);
  return chunks;
};

let concat = (chunks: Uint8Array[]) => new Uint8Array(Buffer.concat(chunks));

describe('readByteStreamHead', () => {
  it('returns streams of up to the limit whole', async () => {
    for (let sizes of [[], [0], [4, 0, 6], [10]]) {
      let total = sizes.reduce((a, b) => a + b, 0);
      let head = await readByteStreamHead(chunksOf(sizes), 10);

      expect(head).toEqual({ type: 'complete', content: expectedBytes(total) });
    }
  });

  it('stops once the stream holds more than the limit and keeps the rest unread', async () => {
    let head = await readByteStreamHead(chunksOf([6, 6, 6, 6]), 10);
    if (head.type != 'partial') throw new Error('expected a partial head');

    expect(head.head).toEqual(expectedBytes(12));

    let rest: Uint8Array[] = [];
    while (true) {
      let next = await head.rest.next();
      if (next.done) break;
      rest.push(next.value);
    }
    expect(rest.map(chunk => chunk.byteLength)).toEqual([6, 6]);
  });

  it('buffers about 25 MB by default', () => {
    expect(streamedUploadHeadBytes).toBe(25 * 1024 * 1024);
  });
});

describe('createChunkedByteStream', () => {
  let streamFrom = async (
    sizes: number[],
    opts: { chunkBytes: number; maxBytes?: number }
  ) => {
    let head = await readByteStreamHead(chunksOf(sizes), 4);
    if (head.type != 'partial') throw new Error('expected a partial head');

    return createChunkedByteStream({ head: head.head, rest: head.rest, ...opts });
  };

  it('sends the head and the rest coalesced into chunks of about chunkBytes', async () => {
    let chunks = await collect(await streamFrom([3, 3, 3, 3, 3, 3, 3], { chunkBytes: 8 }));

    expect(chunks.map(chunk => chunk.byteLength)).toEqual([9, 9, 3]);
    expect(concat(chunks)).toEqual(expectedBytes(21));
  });

  it('only reads the source when the consumer pulls', async () => {
    let pulled = 0;
    let source = async function* () {
      for (let i = 0; i < 100; i++) {
        pulled++;
        yield new Uint8Array(4);
      }
    };

    let stream = createChunkedByteStream({
      head: new Uint8Array(4),
      rest: source()[Symbol.asyncIterator](),
      chunkBytes: 8
    });
    let reader = stream.getReader();
    await reader.read();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(pulled).toBe(1);

    await reader.cancel();
  });

  it('fails the stream once more than maxBytes have been read', async () => {
    let stream = await streamFrom([4, 4, 4, 4], { chunkBytes: 4, maxBytes: 12 });

    await expect(collect(stream)).rejects.toBeInstanceOf(ByteStreamTooLargeError);
  });

  it('passes source errors through', async () => {
    let failing = async function* () {
      yield new Uint8Array(4);
      throw new Error('source broke');
    };

    let stream = createChunkedByteStream({
      head: new Uint8Array(4),
      rest: failing()[Symbol.asyncIterator](),
      chunkBytes: 100
    });

    await expect(collect(stream)).rejects.toThrow('source broke');
  });
});

describe('writeStreamedFile', () => {
  let stored: Uint8Array | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inTransaction = false;
    stored = undefined;
    mocks.enqueueDelete.mockResolvedValue(undefined);
    mocks.addDelete.mockResolvedValue(undefined);
    mocks.putObjectStream.mockImplementation(
      async (d: { key: string; body: ReadableStream<Uint8Array> }) => {
        stored = concat(await collect(d.body));
        return { key: d.key, size: stored.byteLength };
      }
    );
  });

  let partial = async (sizes: number[]) => {
    let head = await readByteStreamHead(chunksOf(sizes), 4);
    if (head.type != 'partial') throw new Error('expected a partial head');
    return head;
  };

  it('streams to a unique key and creates the file with the stored size', async () => {
    let create = vi.fn(async (target: { storeId: string; size: number }) => target);
    let head = await partial([3, 3, 3]);

    let result = await writeStreamedFile({
      head: head.head,
      rest: head.rest,
      contentType: 'text/plain',
      create
    });

    expect(stored).toEqual(expectedBytes(9));
    expect(result.size).toBe(9);
    expect(result.storeId).toMatch(/^[A-Za-z0-9]{20}$/);
    expect(mocks.putObjectStream).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'cargo-files',
        key: result.storeId,
        contentType: 'text/plain'
      })
    );
    expect(mocks.enqueueDelete).not.toHaveBeenCalled();
    expect(mocks.addDelete).not.toHaveBeenCalled();
  });

  it('removes the object when the file could not be created', async () => {
    let head = await partial([3, 3, 3]);

    await expect(
      writeStreamedFile({
        head: head.head,
        rest: head.rest,
        contentType: 'text/plain',
        create: async () => {
          throw new Error('purpose too small');
        }
      })
    ).rejects.toThrow('purpose too small');

    let key = mocks.putObjectStream.mock.calls[0]![0].key;
    expect(mocks.enqueueDelete).toHaveBeenCalledWith('cargo-files', [key]);
  });

  it('schedules a guarded cleanup in case the surrounding transaction rolls back', async () => {
    mocks.inTransaction = true;
    let head = await partial([3, 3, 3]);

    let result = await writeStreamedFile({
      head: head.head,
      rest: head.rest,
      contentType: 'text/plain',
      create: async target => target
    });

    expect(mocks.addDelete).toHaveBeenCalledWith(
      { bucket: 'cargo-files', keys: [result.storeId] },
      { delay: 10 * 60 * 1000 }
    );
  });

  it('reports a stream over the upload limit as a bad request', async () => {
    mocks.putObjectStream.mockRejectedValueOnce(new ByteStreamTooLargeError(1024));
    let head = await partial([3, 3, 3]);
    let create = vi.fn();

    let error = await writeStreamedFile({
      head: head.head,
      rest: head.rest,
      contentType: 'text/plain',
      create
    }).catch(error => error);

    expect(error).toBeInstanceOf(ServiceError);
    expect(error.message).toContain('Files can be at most 1 KB');
    expect(create).not.toHaveBeenCalled();
    expect(mocks.enqueueDelete).not.toHaveBeenCalled();
  });
});
