import { useCurrentInstance, useProviderRunLogs } from '@metorial/state';
import { useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { RunLogs } from '../../../components/runLogs';

export let ProviderRunLogs = ({
  providerRunId,
  lazy = false
}: {
  providerRunId: string;
  lazy?: boolean;
}) => {
  let ref = useRef<HTMLDivElement>(null);
  let inView = useInView(ref, {});
  let [canFetch, setCanFetch] = useState(!lazy);

  useEffect(() => {
    if (inView) setCanFetch(true);
  }, [inView]);

  let instance = useCurrentInstance();
  let logs = useProviderRunLogs(
    canFetch ? instance.data?.id : undefined,
    canFetch ? providerRunId : undefined
  );

  let bodyRef = useRef<HTMLDivElement>(null);
  let prevCountRef = useRef(0);

  useEffect(() => {
    let count = logs.data?.logs?.length ?? 0;
    if (count > prevCountRef.current && bodyRef.current) {
      bodyRef.current.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
    }
    prevCountRef.current = count;
  }, [logs.data?.logs?.length]);

  let logItems = logs.data?.logs ?? [];

  return (
    <div ref={ref}>
      {canFetch ? (
        <RunLogs
          logs={logItems}
          isLoading={logs.isLoading}
          hideWhenEmpty={lazy}
          bodyRef={bodyRef}
        />
      ) : null}
    </div>
  );
};
