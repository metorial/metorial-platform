import { ServiceError } from '@lowerdeck/error';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { sinkBusyError, type RecordSink } from './types';

let defaultMaxPendingBytes = 64 * 1024 * 1024;

export let createNdjsonSink = (
  path: string,
  opts: { maxPendingBytes?: number } = {}
): RecordSink => {
  let maxPendingBytes = opts.maxPendingBytes ?? defaultMaxPendingBytes;

  let pendingBytes = 0;
  let tail: Promise<unknown> = mkdir(dirname(path), { recursive: true });

  return {
    write: async batch => {
      if (batch.records.length == 0) return;

      let text = batch.records.map(record => JSON.stringify(record)).join('\n') + '\n';
      let size = Buffer.byteLength(text);

      if (pendingBytes + size > maxPendingBytes) throw new ServiceError(sinkBusyError());

      pendingBytes += size;

      let run = tail.then(() => appendFile(path, text));
      tail = run.catch(() => {});

      try {
        await run;
      } finally {
        pendingBytes -= size;
      }
    },

    close: async () => {
      await tail;
    }
  };
};
