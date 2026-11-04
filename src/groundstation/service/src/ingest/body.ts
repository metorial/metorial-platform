import { isServiceError, ServiceError } from '@lowerdeck/error';
import { ingestLimits, type IngestContentEncoding } from '@metorial/groundstation-spec';
import { Duplex } from 'node:stream';
import { createGunzip, createZstdDecompress } from 'node:zlib';
import { payloadTooLargeError, tooManyItemsError, unreadableBodyError } from './errors';

let newline = 0x0a;
let carriageReturn = 0x0d;

let decompressors = { gzip: createGunzip, zstd: createZstdDecompress };

let limitBytes = (maxBytes: number) => {
  let total = 0;

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;

      if (total > maxBytes) throw new ServiceError(payloadTooLargeError());

      controller.enqueue(chunk);
    }
  });
};

let iterateChunks = async function* (stream: ReadableStream<Uint8Array>) {
  let reader = stream.getReader();

  try {
    while (true) {
      let { done, value } = await reader.read();
      if (done) return;

      yield value!;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
};

let mapStreamErrors = (source: ReadableStream<Uint8Array>) => {
  let reader = source.getReader();

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        let { done, value } = await reader.read();

        if (done) controller.close();
        else controller.enqueue(value);
      } catch (error) {
        controller.error(
          isServiceError(error) ? error : new ServiceError(unreadableBodyError())
        );
      }
    },

    cancel(reason) {
      return reader.cancel(reason);
    }
  });
};

export let decodeBody = (
  body: ReadableStream<Uint8Array> | null,
  contentEncoding: IngestContentEncoding,
  maxBytes: number = ingestLimits.maxBodyBytes
): ReadableStream<Uint8Array> | null => {
  if (!body) return null;

  let wire = body.pipeThrough(limitBytes(maxBytes));

  if (contentEncoding == 'identity') return mapStreamErrors(wire);

  let decompressor = Duplex.toWeb(decompressors[contentEncoding]());

  let decompressed = wire
    .pipeThrough(decompressor as unknown as ReadableWritablePair<Uint8Array, Uint8Array>)
    .pipeThrough(limitBytes(maxBytes));

  return mapStreamErrors(decompressed);
};

export let readBody = async (body: ReadableStream<Uint8Array> | null): Promise<Uint8Array> => {
  if (!body) return new Uint8Array();

  let chunks: Uint8Array[] = [];
  let length = 0;

  for await (let chunk of iterateChunks(body)) {
    chunks.push(chunk);
    length += chunk.byteLength;
  }

  let result = new Uint8Array(length);
  let offset = 0;

  for (let chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
};

let stripTrailingCarriageReturn = (line: Uint8Array) =>
  line.length > 0 && line[line.length - 1] == carriageReturn
    ? line.subarray(0, line.length - 1)
    : line;

export let readNdjsonLines = async function* (
  body: ReadableStream<Uint8Array> | null,
  opts: { maxLines?: number } = {}
): AsyncGenerator<string> {
  if (!body) return;

  let maxLines = opts.maxLines ?? ingestLimits.maxBulkItems + 1;
  let decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });

  let lineCount = 0;
  let pending: Uint8Array[] = [];
  let pendingLength = 0;

  let takePending = (tail: Uint8Array) => {
    let line: Uint8Array;

    if (pending.length == 0) {
      line = tail;
    } else {
      line = new Uint8Array(pendingLength + tail.length);
      let offset = 0;

      for (let part of pending) {
        line.set(part, offset);
        offset += part.length;
      }

      line.set(tail, offset);
    }

    pending = [];
    pendingLength = 0;

    return stripTrailingCarriageReturn(line);
  };

  let toLine = (bytes: Uint8Array): string | null => {
    if (bytes.length == 0) return null;

    let text: string;

    try {
      text = decoder.decode(bytes);
    } catch {
      throw new ServiceError(unreadableBodyError());
    }

    if (text.trim().length == 0) return null;

    lineCount++;
    if (lineCount > maxLines) throw new ServiceError(tooManyItemsError());

    return text;
  };

  for await (let chunk of iterateChunks(body)) {
    let start = 0;

    while (start < chunk.length) {
      let end = chunk.indexOf(newline, start);

      if (end == -1) {
        let rest = chunk.subarray(start);
        pending.push(rest);
        pendingLength += rest.length;
        break;
      }

      let line = toLine(takePending(chunk.subarray(start, end)));
      if (line !== null) yield line;

      start = end + 1;
    }
  }

  let last = toLine(takePending(new Uint8Array()));
  if (last !== null) yield last;
};
