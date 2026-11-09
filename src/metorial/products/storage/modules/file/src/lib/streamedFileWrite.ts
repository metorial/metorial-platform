import { badRequestError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { cargoObjectDelete } from '../queues/objectDelete';
import { getCargoFilesBucketName, putObjectStream } from '../storage';
import { scheduleRolledBackObjectCleanup } from './contentAddressedWrite';
import { formatByteSize, maxUploadSize } from './uploadPolicy';

export let streamedUploadHeadBytes = 25 * 1024 * 1024;

export let streamedUploadChunkBytes = 50 * 1024 * 1024;

export class ByteStreamTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Files can be at most ${formatByteSize(maxBytes)}.`);
    this.name = 'ByteStreamTooLargeError';
  }
}

export type ByteStreamHead =
  | { type: 'complete'; content: Uint8Array<ArrayBuffer> }
  | { type: 'partial'; head: Uint8Array; rest: AsyncIterator<Uint8Array> };

let concatChunks = (chunks: Uint8Array[], size: number) => {
  let bytes = new Uint8Array(size);
  let offset = 0;
  for (let chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
};

// Stops once more than `limit` bytes have arrived, so a stream of at most `limit` bytes is always
// returned whole.
export let readByteStreamHead = async (
  content: AsyncIterable<Uint8Array>,
  limit = streamedUploadHeadBytes
): Promise<ByteStreamHead> => {
  let iterator = content[Symbol.asyncIterator]();
  let chunks: Uint8Array[] = [];
  let size = 0;

  while (size <= limit) {
    let next = await iterator.next();
    if (next.done) return { type: 'complete', content: concatChunks(chunks, size) };
    if (!next.value.byteLength) continue;

    chunks.push(next.value);
    size += next.value.byteLength;
  }

  return { type: 'partial', head: concatChunks(chunks, size), rest: iterator };
};

// Pull-based with no read-ahead, so at most one coalesced chunk is held while the previous one is
// being sent.
export let createChunkedByteStream = (d: {
  head: Uint8Array;
  rest: AsyncIterator<Uint8Array>;
  chunkBytes?: number;
  maxBytes?: number;
}) => {
  let chunkBytes = d.chunkBytes ?? streamedUploadChunkBytes;
  let maxBytes = d.maxBytes ?? maxUploadSize;
  let head: Uint8Array | null = d.head;
  let total = 0;

  let release = async () => {
    await d.rest.return?.();
  };

  return new ReadableStream<Uint8Array>(
    {
      pull: async controller => {
        let chunks: Uint8Array[] = head ? [head] : [];
        let size = head?.byteLength ?? 0;
        let done = false;
        head = null;

        while (size < chunkBytes) {
          let next = await d.rest.next();
          if (next.done) {
            done = true;
            break;
          }

          chunks.push(next.value);
          size += next.value.byteLength;
        }

        total += size;
        if (total > maxBytes) {
          controller.error(new ByteStreamTooLargeError(maxBytes));
          await release();
          return;
        }

        if (size) {
          controller.enqueue(chunks.length == 1 ? chunks[0]! : concatChunks(chunks, size));
        }
        if (done) controller.close();
      },
      cancel: release
    },
    { highWaterMark: 0 }
  );
};

// For streams too large to buffer: written under a unique key, since the sha256 that would name
// a content-addressed object is only known once the last byte has been sent.
export let writeStreamedFile = async <T>(d: {
  head: Uint8Array;
  rest: AsyncIterator<Uint8Array>;
  contentType: string;
  create: (target: { storeId: string; size: number }) => Promise<T>;
}) => {
  let storeId = generatePlainId(20);
  let bucket = getCargoFilesBucketName();

  let stored = await putObjectStream({
    bucket,
    key: storeId,
    body: createChunkedByteStream({ head: d.head, rest: d.rest }),
    contentType: d.contentType
  }).catch(error => {
    if (error instanceof ByteStreamTooLargeError) {
      throw new ServiceError(badRequestError({ message: error.message }));
    }
    throw error;
  });

  let result: T;
  try {
    result = await d.create({ storeId, size: stored.size });
  } catch (error) {
    await cargoObjectDelete.enqueue(bucket, [storeId]).catch(() => {});
    throw error;
  }

  await scheduleRolledBackObjectCleanup(storeId);

  return result;
};
