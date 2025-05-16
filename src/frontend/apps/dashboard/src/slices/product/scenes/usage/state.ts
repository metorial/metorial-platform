import { useCurrentOrganization, useUsage } from '@metorial/state';
import { endOfDay, startOfDay, subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import { useNow } from '../../../../hooks/useNow';

export let useUsageState = (opts: {
  entities: {
    type: string;
    id: string;
  }[];

  from?: number;
  interval?: {
    unit: 'day' | 'hour';
    count: number;
  };
}) => {
  let org = useCurrentOrganization();

  let [from, setFrom] = useState(() =>
    startOfDay(subDays(new Date(), Math.abs(opts.from || 7)))
  );
  let now = useNow();
  let [to, setTo] = useState(() => endOfDay(new Date()));
  let toNormalized = useMemo(() => (to > now ? now : to), [to, now]);

  let [interval, setInterval] = useState(
    () => opts.interval || { unit: 'hour' as const, count: 1 }
  );

  let usage = useUsage(
    org.data?.id,
    opts.entities.length
      ? {
          entities: opts.entities,
          from,
          to: toNormalized,
          interval
        }
      : null
  );

  return [
    {
      ...usage,
      data: usage.data?.timeline.map(d => ({
        ...d,
        entries: d.entries.sort((a, b) => a.ts.getTime() - b.ts.getTime())
      }))
    },
    {
      from,
      setFrom,

      to,
      setTo,

      interval,
      setInterval
    }
  ] as const;
};
