import { useSyncExternalStore } from 'react';

let changes = new Map<string, Date>();
let listeners = new Set<() => void>();

let changeKey = (instanceId: string, callbackId: string) => `${instanceId}:${callbackId}`;

let subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// The server time of the save, so it can be compared with the server times of callback instances.
export let recordCallbackSelectionsChange = (
  instanceId: string,
  callbackId: string,
  changedAt: Date
) => {
  changes.set(changeKey(instanceId, callbackId), changedAt);
  for (let listener of listeners) listener();
};

export let useCallbackSelectionsChangedAt = (
  instanceId: string | null | undefined,
  callbackId: string | null | undefined
) =>
  useSyncExternalStore(subscribe, () =>
    instanceId && callbackId ? (changes.get(changeKey(instanceId, callbackId)) ?? null) : null
  );
