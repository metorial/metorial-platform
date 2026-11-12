import { ServiceError } from '@lowerdeck/error';
import type { NormalizedRecord, RecordLane } from '@metorial/groundstation-spec';
import { sinkBusyError, type RecordSink } from './types';

let defaultMaxRecords = 50_000;

export type StoredRecord = { lane: RecordLane; tenantId: string; record: NormalizedRecord };

export type MemorySink = RecordSink & {
  list: (filter?: { tenantId?: string; lane?: RecordLane; limit?: number }) => StoredRecord[];
  clear: () => void;
  size: () => number;
  failNext: (error?: Error) => void;
  setBusy: (busy: boolean) => void;
};

export let createMemorySink = (opts: { maxRecords?: number } = {}): MemorySink => {
  let maxRecords = opts.maxRecords ?? defaultMaxRecords;

  let stored: StoredRecord[] = [];
  let nextFailure: Error | undefined;
  let busy = false;

  return {
    write: async batch => {
      if (nextFailure) {
        let failure = nextFailure;
        nextFailure = undefined;

        throw failure;
      }

      if (busy) throw new ServiceError(sinkBusyError());

      for (let record of batch.records) {
        stored.push({ lane: batch.lane, tenantId: batch.tenantId, record });
      }

      if (stored.length > maxRecords) stored.splice(0, stored.length - maxRecords);
    },

    list: (filter = {}) => {
      let matching = stored.filter(
        item =>
          (!filter.tenantId || item.tenantId == filter.tenantId) &&
          (!filter.lane || item.lane == filter.lane)
      );

      return filter.limit ? matching.slice(-filter.limit) : matching;
    },

    clear: () => {
      stored = [];
    },

    size: () => stored.length,

    failNext: error => {
      nextFailure = error ?? new Error('memory sink failure');
    },

    setBusy: value => {
      busy = value;
    }
  };
};
