import type { AgentTrackingEvents } from './catalog';

type Listener<T> = (data: T) => void | Promise<void>;

let listeners = new Map<string, Set<Listener<any>>>();

// Listeners run concurrently and are awaited, so a fire inside a service finishes the reactions
// before the service returns; a failing listener fails the fire, like Fabric.
export let Events = {
  fire: async <K extends keyof AgentTrackingEvents>(
    event: K,
    data: AgentTrackingEvents[K]
  ) => {
    let set = listeners.get(event);
    if (!set) return;

    await Promise.all([...set].map(listener => listener(data)));
  },

  listen: <K extends keyof AgentTrackingEvents>(
    event: K,
    listener: Listener<AgentTrackingEvents[K]>
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
