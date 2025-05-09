import { FabricEvents } from './types';

let listeners = new Map<string, Set<(data: any) => void | Promise<void>>>();

export let Fabric = {
  fire: async <K extends keyof FabricEvents>(
    event: K,
    data: FabricEvents[K] extends void | never | undefined
      ? never | undefined
      : FabricEvents[K]
  ) => {
    let listenerSet = listeners.get(event);
    if (!listenerSet) return;

    await Promise.all(Array.from(listenerSet).map(l => l(data)));
  },

  listen: <K extends keyof FabricEvents>(
    event: K,
    callback: (data: FabricEvents[K]) => void | Promise<void>
  ) => {
    let listenerSet = listeners.get(event);
    if (!listenerSet) {
      listenerSet = new Set();
      listeners.set(event, listenerSet);
    }

    listenerSet.add(callback);

    return () => {
      listenerSet?.delete(callback);
      if (listenerSet.size === 0) {
        listeners.delete(event);
      }
    };
  }
};
