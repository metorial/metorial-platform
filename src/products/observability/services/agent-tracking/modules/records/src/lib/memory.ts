import { ServiceError } from '@lowerdeck/error';
import type { NormalizedRecord, RecordLane } from '@mtsrc/agent-tracking-spec';
import { sinkBusyError, type RecordSink } from '@mtsrc/agent-tracking-store';

let defaultMaxRecords = 50_000;

export type StoredRecord = {
  lane: RecordLane;
  organizationId: string;
  projectId: string;
  instanceId: string;
  record: NormalizedRecord;
};

export type MemorySinkFilter = {
  organizationId?: string;
  instanceId?: string;
  lane?: RecordLane;
  limit?: number;
};

export type MemorySinkScope = {
  organizationId: string;
  projectId?: string;
  instanceId?: string;
};

export type MemorySink = RecordSink & {
  list: (filter?: MemorySinkFilter) => StoredRecord[];
  erase: (scope: MemorySinkScope) => number;
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
        stored.push({
          lane: batch.lane,
          organizationId: batch.organizationId,
          projectId: batch.projectId,
          instanceId: batch.instanceId,
          record
        });
      }

      if (stored.length > maxRecords) stored.splice(0, stored.length - maxRecords);
    },

    list: (filter = {}) => {
      let matching = stored.filter(
        item =>
          (!filter.organizationId || item.organizationId == filter.organizationId) &&
          (!filter.instanceId || item.instanceId == filter.instanceId) &&
          (!filter.lane || item.lane == filter.lane)
      );

      return filter.limit ? matching.slice(-filter.limit) : matching;
    },

    erase: scope => {
      let before = stored.length;

      stored = stored.filter(
        item =>
          item.organizationId != scope.organizationId ||
          (!!scope.projectId && item.projectId != scope.projectId) ||
          (!!scope.instanceId && item.instanceId != scope.instanceId)
      );

      return before - stored.length;
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
