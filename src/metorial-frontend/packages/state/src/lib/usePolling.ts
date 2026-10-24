import { useEffect, useRef } from 'react';

export let usePolling = (refetch: () => unknown, active: boolean, intervalMs: number) => {
  let refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!active) return;

    let id = setInterval(() => refetchRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
};
