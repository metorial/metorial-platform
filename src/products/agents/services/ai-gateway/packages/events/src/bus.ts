import type { AiGatewayEvents } from './catalog';

type Listener<T> = (data: T) => void | Promise<void>;

let listeners = new Map<string, Set<Listener<any>>>();

// In-process only: listeners run concurrently and are awaited, so a fire inside a service finishes
// the reactions before the service returns. Anything another replica must see goes through Redis
// (the credential and routing caches), not through this bus.
export let Events = {
  fire: async <K extends keyof AiGatewayEvents>(event: K, data: AiGatewayEvents[K]) => {
    let set = listeners.get(event);
    if (!set) return;

    await Promise.all([...set].map(listener => listener(data)));
  },

  listen: <K extends keyof AiGatewayEvents>(
    event: K,
    listener: Listener<AiGatewayEvents[K]>
  ) => {
    let set = listeners.get(event) ?? new Set();
    set.add(listener);
    listeners.set(event, set);

    return () => {
      set.delete(listener);
      if (!set.size) listeners.delete(event);
    };
  }
};
