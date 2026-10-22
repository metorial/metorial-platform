import type { ChartSelection, ChartSelectionRange } from '@metorial/chart';
import { useMetricsTimeRange } from '@metorial/metrics-page';
import {
  deserializeFromQuery,
  getDateRangeFilterValue,
  getFilterPayload,
  type TableFilter
} from '@metorial/table';
import { OptionToggle } from '@metorial/ui';
import { formatFilterDateRange } from '@metorial/ui-product';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createdFromParam, createdToParam } from './links';
import { usageRetentionMs, type UsageFilter, type UsageRange } from './query';
import type { UsageEventsSegment } from './series';

let compactPresets = [
  { id: '1h', label: '1h', durationMs: 60 * 60 * 1000 },
  { id: '24h', label: '24h', durationMs: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7d', durationMs: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: '30d', durationMs: 30 * 24 * 60 * 60 * 1000 }
];

export let useCompactUsageRange = (defaultPreset = '24h') => {
  let [preset, setPreset] = useState(defaultPreset);
  let live = useMetricsTimeRange(
    { type: 'preset', preset },
    { presets: compactPresets, retentionMs: usageRetentionMs, refreshIntervalMs: 60_000 }
  );

  let range = useMemo<UsageRange>(
    () => ({ from: live.from, to: live.to, interval: undefined }),
    [live]
  );

  let picker = (
    <OptionToggle
      ariaLabel="Time Range"
      size="1"
      itemMinWidth={36}
      value={preset}
      onChange={setPreset}
      items={compactPresets.map(item => ({ id: item.id, label: item.label }))}
    />
  );

  return { range, picker, setPreset };
};

let getCoveringPreset = (fromMs: number, nowMs: number) =>
  (
    compactPresets.find(preset => nowMs - preset.durationMs <= fromMs) ??
    compactPresets[compactPresets.length - 1]!
  ).id;

let createdAtFilter: TableFilter<any> = {
  id: 'createdAt',
  fields: ['createdAt'],
  label: 'Created',
  description: 'Filter by creation time',
  type: 'date'
};

let createdAtParams = ['', '_gt', '_lt', '_gte', '_lte'].map(suffix => `createdAt${suffix}`);

let getCreatedAtRange = (params: URLSearchParams) =>
  getDateRangeFilterValue(
    getFilterPayload(deserializeFromQuery(params, [createdAtFilter])).createdAt
  );

type LogsUsageDimension = 'providerId' | 'deploymentId' | 'consumerId';

export type LogsUsageFilterSpec = {
  dimensions?: Partial<Record<LogsUsageDimension, string>>;
  errorTypeParam?: string;
  status?: { param: string; success: string[]; error: string[] };
  unsupported?: { param: string; label: string }[];
};

export let useLogsUsageFilters = (spec: LogsUsageFilterSpec, defaultPreset = '24h') => {
  let [params, setParams] = useSearchParams();
  let created = getCreatedAtRange(params);
  let { range, picker, setPreset } = useCompactUsageRange(defaultPreset);

  let createdKey = `${created?.gt?.getTime()}:${created?.lt?.getTime()}`;
  let selectionBounds = useMemo(() => {
    if (!created) return undefined;

    let from = created.gt ? created.gt.getTime() + 1 : range.from.getTime();
    let to = created.lt ? created.lt.getTime() : range.to.getTime();
    return from < to ? { from, to } : undefined;
  }, [createdKey]);

  useEffect(() => {
    if (!selectionBounds) return;
    let now = Date.now();
    if (selectionBounds.from < range.from.getTime()) {
      setPreset(getCoveringPreset(selectionBounds.from, now));
    }
  }, [createdKey]);

  let selection = useMemo<ChartSelection>(() => {
    let writeRange = (range: ChartSelectionRange | null, replace: boolean) => {
      let next = new URLSearchParams(window.location.search);
      for (let key of [...createdAtParams, 'before', 'after']) next.delete(key);
      if (range) {
        next.set(createdFromParam, range.from.toISOString());
        next.set(createdToParam, new Date(range.to.getTime() - 1).toISOString());
      }
      setParams(next, { replace });
    };

    return {
      range: selectionBounds
        ? { from: new Date(selectionBounds.from), to: new Date(selectionBounds.to) }
        : null,
      formatLabel: ({ from, to }) => formatFilterDateRange(from, new Date(to.getTime() - 1)),
      onChange: range => writeRange(range, false),
      onClear: () => writeRange(null, true)
    };
  }, [selectionBounds, setParams]);

  let paramsKey = params.toString();
  let { filter, segments, ignored } = useMemo(() => {
    let filter: UsageFilter = {};
    for (let [dimension, param] of Object.entries(spec.dimensions ?? {})) {
      let value = params.get(param);
      if (value) filter[dimension as LogsUsageDimension] = value;
    }

    let errorTypes = spec.errorTypeParam
      ? params.get(spec.errorTypeParam)?.split(',').filter(Boolean)
      : undefined;
    if (errorTypes?.length) filter.errorType = errorTypes;

    let ignored = (spec.unsupported ?? [])
      .filter(item => params.get(item.param))
      .map(item => item.label);

    let segments: UsageEventsSegment[] | undefined;
    let statuses = spec.status
      ? params.get(spec.status.param)?.split(',').filter(Boolean)
      : [];
    if (spec.status && statuses?.length) {
      let { success, error } = spec.status;
      let selected = new Set<UsageEventsSegment>();
      for (let status of statuses) {
        if (success.includes(status)) selected.add('success');
        else if (error.includes(status)) selected.add('error');
        else if (!ignored.includes('status')) ignored.push('status');
      }
      if (selected.size) segments = [...selected];
    }

    return { filter, segments, ignored };
  }, [paramsKey]);

  let hint = ignored.length ? `Chart not filtered by ${ignored.join(', ')}` : undefined;

  return { range, filter, segments, selection, picker, hint };
};
