import { useEffect, useState } from 'react';
import { useDocumentVisible } from './useDocumentVisible';
import { usePolling } from './usePolling';

// Each time the work becomes unsettled, is restarted or the tab is shown again, refreshing runs
// for at most `timeoutMs`. Components passing the same `key` share one refresh loop.
export let useRefreshUntilSettled = ({
  key,
  settled,
  refresh,
  restartKey,
  intervalMs,
  timeoutMs
}: {
  key: string | null;
  settled: boolean;
  refresh: () => unknown;
  restartKey?: string | number | null;
  intervalMs: number;
  timeoutMs: number;
}) => {
  let visible = useDocumentVisible();
  let waiting = !settled && visible;

  // Becoming unsettled or visible again starts a new run. Tracked during render, so the first
  // render of a new run never sees the previous run's timeout.
  let [runs, setRuns] = useState({ count: 0, waiting });
  let count = waiting && !runs.waiting ? runs.count + 1 : runs.count;
  if (runs.waiting !== waiting) setRuns({ count, waiting });

  let run = JSON.stringify([key, restartKey ?? null, count]);
  let [timedOutRun, setTimedOutRun] = useState<string | null>(null);
  let timedOut = timedOutRun === run;

  useEffect(() => {
    if (!waiting) return;

    let timer = setTimeout(() => setTimedOutRun(run), timeoutMs);
    return () => clearTimeout(timer);
  }, [run, waiting, timeoutMs]);

  usePolling(key, refresh, waiting && !timedOut, intervalMs);

  return {
    isRefreshing: !settled && !timedOut,
    hasTimedOut: !settled && timedOut
  };
};
