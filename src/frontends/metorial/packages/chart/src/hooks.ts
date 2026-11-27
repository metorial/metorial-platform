import { useMemo, useRef } from 'react';
import {
  formatNumber,
  type SeriesValueFormatter,
  type TooltipValueFormatter,
  type ValueFormatter
} from './format';

let defaultFormatter: ValueFormatter = value => formatNumber(value);

export let useStableFormatters = (
  valueFormatter: ValueFormatter | undefined,
  tickFormatter: ValueFormatter | undefined,
  seriesValueFormatter?: SeriesValueFormatter
) => {
  let latest = useRef({ valueFormatter, tickFormatter, seriesValueFormatter });
  latest.current = { valueFormatter, tickFormatter, seriesValueFormatter };

  return useMemo(
    () => ({
      formatValue: ((value: number, seriesIds?: string[]) =>
        seriesIds && latest.current.seriesValueFormatter
          ? latest.current.seriesValueFormatter(value, seriesIds)
          : (latest.current.valueFormatter ?? defaultFormatter)(
              value
            )) as TooltipValueFormatter,
      formatTick: (value: number) =>
        (latest.current.tickFormatter ?? latest.current.valueFormatter ?? defaultFormatter)(
          value
        )
    }),
    []
  );
};
