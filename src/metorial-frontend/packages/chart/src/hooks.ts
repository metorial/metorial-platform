import { useMemo, useRef } from 'react';
import { formatNumber, ValueFormatter } from './format';

let defaultFormatter: ValueFormatter = value => formatNumber(value);

export let useStableFormatters = (
  valueFormatter: ValueFormatter | undefined,
  tickFormatter: ValueFormatter | undefined
) => {
  let latest = useRef({ valueFormatter, tickFormatter });
  latest.current = { valueFormatter, tickFormatter };

  return useMemo(
    () => ({
      formatValue: (value: number) =>
        (latest.current.valueFormatter ?? defaultFormatter)(value),
      formatTick: (value: number) =>
        (latest.current.tickFormatter ?? latest.current.valueFormatter ?? defaultFormatter)(
          value
        )
    }),
    []
  );
};
