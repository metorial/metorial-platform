import { useEffect, useMemo, useState } from 'react';
import {
  getMetricsRangeKey,
  MetricsRange,
  MetricsRangeLimits,
  MetricsRangePreset,
  MetricsTimeRange,
  resolveMetricsRange
} from './range';

export let useMetricsTimeRange = (
  range: MetricsRange,
  opts: MetricsRangeLimits & {
    presets?: MetricsRangePreset[];
    refreshIntervalMs?: number;
  } = {}
): MetricsTimeRange => {
  let rangeKey = getMetricsRangeKey(range);
  let presetsKey = opts.presets?.map(preset => `${preset.id}=${preset.durationMs}`).join(',');
  let isLive = range.type == 'preset' && !!opts.refreshIntervalMs;

  let [refreshedAt, setRefreshedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!isLive) return;

    let timer = setInterval(() => setRefreshedAt(Date.now()), opts.refreshIntervalMs);
    return () => clearInterval(timer);
  }, [isLive, opts.refreshIntervalMs, rangeKey]);

  return useMemo(
    () =>
      resolveMetricsRange(range, {
        now: new Date(),
        presets: opts.presets,
        retentionMs: opts.retentionMs,
        maxSpanMs: opts.maxSpanMs
      }),
    [rangeKey, presetsKey, refreshedAt, opts.retentionMs, opts.maxSpanMs]
  );
};
