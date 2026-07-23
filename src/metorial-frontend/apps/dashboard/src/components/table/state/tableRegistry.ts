import { useLayoutEffect, useState, useSyncExternalStore } from 'react';

type Listener = () => void;

export class MountedTableRegistry {
  #tableIds = new Set<string>();
  #listeners = new Set<Listener>();

  getSnapshot = () => this.#tableIds.size;

  subscribe = (listener: Listener) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  register(tableId: string) {
    let previousSize = this.#tableIds.size;
    this.#tableIds.add(tableId);
    let wasAdded = this.#tableIds.size != previousSize;

    if (wasAdded) this.#notify();

    let isRegistered = wasAdded;
    return () => {
      if (!isRegistered) return;
      isRegistered = false;

      if (this.#tableIds.delete(tableId)) this.#notify();
    };
  }

  #notify() {
    for (let listener of this.#listeners) listener();
  }
}

let mountedTableRegistry = new MountedTableRegistry();

export let useTableQuerySyncEnabled = (tableId: string) => {
  let mountedTableCount = useSyncExternalStore(
    mountedTableRegistry.subscribe,
    mountedTableRegistry.getSnapshot,
    () => 0
  );
  let [isRegistered, setIsRegistered] = useState(false);

  useLayoutEffect(() => {
    let unregister = mountedTableRegistry.register(tableId);
    setIsRegistered(true);

    return unregister;
  }, [tableId]);

  return isRegistered && mountedTableCount == 1;
};
