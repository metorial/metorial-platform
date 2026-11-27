import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { DEFAULT_POLL_INTERVAL_MS, LogWindow, type LogWindowOptions } from './lib/logWindow';

export let useLogWindow = ({
  source,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  initialLimit,
  pageSize,
  maxLines
}: LogWindowOptions) => {
  let logWindow = useMemo(
    () => new LogWindow({ source, pollIntervalMs, initialLimit, pageSize, maxLines }),
    [source, initialLimit, pageSize, maxLines]
  );

  useEffect(() => {
    void logWindow.start();
    return () => logWindow.dispose();
  }, [logWindow]);

  useEffect(() => {
    logWindow.setPollInterval(pollIntervalMs);
  }, [logWindow, pollIntervalMs]);

  useEffect(() => {
    let update = () => logWindow.setVisible(document.visibilityState != 'hidden');

    update();
    document.addEventListener('visibilitychange', update);

    return () => document.removeEventListener('visibilitychange', update);
  }, [logWindow]);

  let state = useSyncExternalStore(
    logWindow.subscribe,
    logWindow.getState,
    logWindow.getState
  );

  return { logWindow, state };
};
