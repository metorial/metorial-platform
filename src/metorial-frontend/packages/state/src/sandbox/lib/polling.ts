import { useEffect, useRef } from 'react';
import { useDocumentVisible } from '../../lib/useDocumentVisible';

export type SandboxPollInterval<Data> =
  | number
  | false
  | null
  | ((data: Data | null) => number | false | null | undefined);

export type SandboxPollOptions<Data> = {
  pollInterval?: SandboxPollInterval<Data>;
};

let resolvePollInterval = <Data>(opts: {
  data: Data | null;
  pollInterval: SandboxPollInterval<Data> | undefined;
  defaultInterval?: (data: Data) => number | false;
}) => {
  if (opts.data === null || opts.data === undefined) return false;

  let interval =
    opts.pollInterval === undefined
      ? opts.defaultInterval?.(opts.data)
      : typeof opts.pollInterval == 'function'
        ? opts.pollInterval(opts.data)
        : opts.pollInterval;

  return typeof interval == 'number' && interval > 0 ? interval : false;
};

export let useSandboxPolling = <Data>(opts: {
  data: Data | null;
  refetch: () => unknown;
  pollInterval: SandboxPollInterval<Data> | undefined;
  defaultInterval?: (data: Data) => number | false;
}) => {
  let visible = useDocumentVisible();
  let intervalMs = resolvePollInterval(opts);

  let refetchRef = useRef(opts.refetch);
  refetchRef.current = opts.refetch;

  let intervalRef = useRef(intervalMs);
  intervalRef.current = intervalMs;

  let wasHiddenRef = useRef(false);

  useEffect(() => {
    if (!visible || !intervalMs) return;

    let id = setInterval(() => refetchRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [visible, intervalMs]);

  useEffect(() => {
    if (!visible) {
      wasHiddenRef.current = true;
      return;
    }

    if (!wasHiddenRef.current) return;
    wasHiddenRef.current = false;

    if (intervalRef.current) refetchRef.current();
  }, [visible]);
};
