import { useEffect, useRef } from 'react';

type Poller = {
  subscribers: number;
  timer: ReturnType<typeof setInterval>;
  refetch: () => unknown;
};

let pollers = new Map<string, Poller>();

// Several components can read the same loader (a layout and its page, for example). Without a
// shared key each would run its own timer and every poll would fetch the data once per component.
export let usePolling = (
  key: string | null,
  refetch: () => unknown,
  active: boolean,
  intervalMs: number
) => {
  let refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!active || !key) return;

    let poller = pollers.get(`${key}:${intervalMs}`);
    if (!poller) {
      poller = {
        subscribers: 0,
        refetch: () => refetchRef.current(),
        timer: setInterval(() => pollers.get(`${key}:${intervalMs}`)?.refetch(), intervalMs)
      };
      pollers.set(`${key}:${intervalMs}`, poller);
    }
    poller.subscribers++;

    return () => {
      poller.subscribers--;
      if (poller.subscribers > 0) return;

      clearInterval(poller.timer);
      pollers.delete(`${key}:${intervalMs}`);
    };
  }, [key, active, intervalMs]);
};
