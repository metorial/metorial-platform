import type { PatchOperation } from '@lowerdeck/patch';
import { useSyncExternalStore } from 'react';

export type PendingBatch = { id: number; operations: PatchOperation[] };

let noBatches: PendingBatch[] = [];
let nextBatchId = 0;

let batchesByKey = new Map<string, PendingBatch[]>();
let listenersByKey = new Map<string, Set<() => void>>();

let notify = (key: string) => {
  for (let listener of listenersByKey.get(key) ?? []) listener();
};

export let configPendingStore = {
  get: (key: string | null) => (key && batchesByKey.get(key)) || noBatches,

  add: (key: string, operations: PatchOperation[]) => {
    let batch = { id: nextBatchId++, operations };

    batchesByKey.set(key, [...(batchesByKey.get(key) ?? []), batch]);
    notify(key);

    return batch;
  },

  remove: (key: string, batchId: number) => {
    let remaining = (batchesByKey.get(key) ?? []).filter(batch => batch.id != batchId);

    if (remaining.length) batchesByKey.set(key, remaining);
    else batchesByKey.delete(key);

    notify(key);
  },

  subscribe: (key: string | null, listener: () => void) => {
    if (!key) return () => {};

    let listeners = listenersByKey.get(key) ?? new Set();
    listeners.add(listener);
    listenersByKey.set(key, listeners);

    return () => {
      listeners.delete(listener);
      if (!listeners.size) listenersByKey.delete(key);
    };
  }
};

export let usePendingBatches = (key: string | null) =>
  useSyncExternalStore(
    listener => configPendingStore.subscribe(key, listener),
    () => configPendingStore.get(key)
  );
