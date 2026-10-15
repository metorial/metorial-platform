let SECOND = 1000;
let MINUTE = 60 * SECOND;
let HOUR = 60 * MINUTE;
let DAY = 24 * HOUR;

export let autoMetricsInterval = 'auto';

export type MetricsRangePreset = {
  id: string;
  label: string;
  durationMs: number;
};

export type MetricsIntervalOption = {
  id: string;
  label: string;
  durationMs: number;
  retentionMs?: number;
};

export type MetricsIntervalChoice = MetricsIntervalOption & {
  disabled: boolean;
  disabledReason?: string;
  disabledHint?: string;
};

export type MetricsRangePresetChoice = MetricsRangePreset & {
  disabled: boolean;
  disabledReason?: string;
};

export type MetricsRange =
  | { type: 'preset'; preset: string }
  | { type: 'custom'; from: Date; to: Date };

export type MetricsQuery = {
  range: MetricsRange;
  interval: string;
};

export type MetricsTimeRange = {
  from: Date;
  to: Date;
};

export type MetricsRangeLimits = {
  retentionMs?: number;
  maxSpanMs?: number;
};

export type MetricsQueryParamKeys = {
  range: string;
  from: string;
  to: string;
  interval: string;
};

export let defaultMetricsRangePresets: MetricsRangePreset[] = [
  { id: '1h', label: '1h', durationMs: HOUR },
  { id: '6h', label: '6h', durationMs: 6 * HOUR },
  { id: '24h', label: '24h', durationMs: DAY },
  { id: '7d', label: '7d', durationMs: 7 * DAY },
  { id: '30d', label: '30d', durationMs: 30 * DAY }
];

export let defaultMetricsIntervals: MetricsIntervalOption[] = [
  { id: '1m', label: '1 Minute', durationMs: MINUTE },
  { id: '5m', label: '5 Minutes', durationMs: 5 * MINUTE },
  { id: '15m', label: '15 Minutes', durationMs: 15 * MINUTE },
  { id: '1h', label: '1 Hour', durationMs: HOUR },
  { id: '6h', label: '6 Hours', durationMs: 6 * HOUR },
  { id: '1d', label: '1 Day', durationMs: DAY }
];

export let defaultMetricsQuery: MetricsQuery = {
  range: { type: 'preset', preset: '24h' },
  interval: autoMetricsInterval
};

export let defaultMetricsQueryParamKeys: MetricsQueryParamKeys = {
  range: 'range',
  from: 'from',
  to: 'to',
  interval: 'interval'
};

let durationUnits = [
  { name: 'day', short: 'd', ms: DAY },
  { name: 'hour', short: 'h', ms: HOUR },
  { name: 'minute', short: 'm', ms: MINUTE },
  { name: 'second', short: 's', ms: SECOND },
  { name: 'millisecond', short: 'ms', ms: 1 }
];

let getDurationUnit = (ms: number) => {
  let whole = Math.max(1, Math.round(ms));
  let unit =
    durationUnits.find(candidate => whole >= candidate.ms && whole % candidate.ms == 0) ??
    durationUnits[durationUnits.length - 1];

  return { unit, count: whole / unit.ms };
};

export let formatDurationLong = (ms: number) => {
  let { unit, count } = getDurationUnit(ms);
  return `${count} ${unit.name}${count == 1 ? '' : 's'}`;
};

export let formatIntervalShort = (ms: number) => {
  let { unit, count } = getDurationUnit(ms);
  return `${count}${unit.short}`;
};

export let getMetricsRangeKey = (range: MetricsRange) =>
  range.type == 'preset'
    ? `preset:${range.preset}`
    : `custom:${range.from.getTime()}:${range.to.getTime()}`;

export let clampMetricsRange = (
  range: MetricsTimeRange,
  opts: MetricsRangeLimits & { now?: Date; anchor?: 'from' | 'to' } = {}
): MetricsTimeRange => {
  let now = (opts.now ?? new Date()).getTime();
  let earliest = opts.retentionMs === undefined ? -Infinity : now - opts.retentionMs;
  let clamp = (value: number) => Math.min(Math.max(value, earliest), now);

  let from = clamp(range.from.getTime());
  let to = clamp(range.to.getTime());
  if (from > to) [from, to] = [to, from];

  if (opts.maxSpanMs !== undefined && to - from > opts.maxSpanMs) {
    if (opts.anchor == 'from') to = from + opts.maxSpanMs;
    else from = to - opts.maxSpanMs;
  }

  return { from: new Date(from), to: new Date(to) };
};

export let resolveMetricsRange = (
  range: MetricsRange,
  opts: MetricsRangeLimits & { now?: Date; presets?: MetricsRangePreset[] } = {}
): MetricsTimeRange => {
  let now = opts.now ?? new Date();
  let presets = opts.presets ?? defaultMetricsRangePresets;

  if (range.type == 'custom') {
    return clampMetricsRange({ from: range.from, to: range.to }, { ...opts, now });
  }

  let preset = presets.find(candidate => candidate.id == range.preset) ?? presets[0];
  let durationMs = preset?.durationMs ?? DAY;

  return clampMetricsRange(
    { from: new Date(now.getTime() - durationMs), to: now },
    { ...opts, now, anchor: 'to' }
  );
};

let isRetainedFor = (interval: MetricsIntervalOption, range: MetricsTimeRange, now: number) =>
  interval.retentionMs === undefined || range.from.getTime() >= now - interval.retentionMs;

export let getMetricsIntervalChoices = (
  intervals: MetricsIntervalOption[],
  range: MetricsTimeRange,
  opts: { now?: Date; maxPoints?: number } = {}
): MetricsIntervalChoice[] => {
  let now = (opts.now ?? new Date()).getTime();
  let spanMs = range.to.getTime() - range.from.getTime();

  return intervals.map(interval => {
    let disabledReason: string | undefined;
    let disabledHint: string | undefined;

    if (interval.retentionMs !== undefined && !isRetainedFor(interval, range, now)) {
      disabledReason = `Only available for ranges within the last ${formatDurationLong(interval.retentionMs)}.`;
      disabledHint = `Last ${formatDurationLong(interval.retentionMs)} only`;
    } else if (interval.durationMs > spanMs) {
      disabledReason = 'Longer than the selected range.';
      disabledHint = 'Longer than range';
    } else if (opts.maxPoints !== undefined && spanMs / interval.durationMs > opts.maxPoints) {
      disabledReason = 'Too many data points for the selected range.';
      disabledHint = 'Too many points';
    }

    return { ...interval, disabled: !!disabledReason, disabledReason, disabledHint };
  });
};

export let getMetricsPresetChoices = (
  presets: MetricsRangePreset[],
  limits: MetricsRangeLimits = {}
): MetricsRangePresetChoice[] =>
  presets.map(preset => {
    let disabledReason: string | undefined;

    if (limits.retentionMs !== undefined && preset.durationMs > limits.retentionMs) {
      disabledReason = `Metrics are kept for ${formatDurationLong(limits.retentionMs)}.`;
    } else if (limits.maxSpanMs !== undefined && preset.durationMs > limits.maxSpanMs) {
      disabledReason = `Ranges are limited to ${formatDurationLong(limits.maxSpanMs)}.`;
    }

    return { ...preset, disabled: !!disabledReason, disabledReason };
  });

export let pickAutoInterval = (
  intervals: MetricsIntervalOption[],
  range: MetricsTimeRange,
  opts: { now?: Date; targetPoints?: number } = {}
) => {
  let now = (opts.now ?? new Date()).getTime();
  let targetPoints = opts.targetPoints ?? 500;
  let spanMs = range.to.getTime() - range.from.getTime();

  let candidates = intervals
    .filter(interval => isRetainedFor(interval, range, now))
    .sort((a, b) => a.durationMs - b.durationMs);

  return (
    candidates.find(interval => spanMs / interval.durationMs <= targetPoints) ??
    candidates[candidates.length - 1]
  );
};

export let resolveMetricsInterval = (
  intervalId: string,
  intervals: MetricsIntervalOption[],
  range: MetricsTimeRange,
  opts: { now?: Date; maxPoints?: number } = {}
) => {
  if (intervalId == autoMetricsInterval) return undefined;

  let choice = getMetricsIntervalChoices(intervals, range, opts).find(
    candidate => candidate.id == intervalId
  );
  if (!choice || choice.disabled) return undefined;

  return intervals.find(interval => interval.id == choice.id);
};

let readParam = (
  params: URLSearchParams | Record<string, string | null | undefined>,
  key: string
) => (params instanceof URLSearchParams ? params.get(key) : params[key]) ?? undefined;

let parseDate = (value: string | undefined) => {
  if (!value) return undefined;

  let date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export let parseMetricsQuery = (
  params: URLSearchParams | Record<string, string | null | undefined>,
  opts: {
    defaultQuery?: MetricsQuery;
    presets?: MetricsRangePreset[];
    intervals?: MetricsIntervalOption[];
    keys?: Partial<MetricsQueryParamKeys>;
  } = {}
): MetricsQuery => {
  let keys = { ...defaultMetricsQueryParamKeys, ...opts.keys };
  let fallback = opts.defaultQuery ?? defaultMetricsQuery;
  let presets = opts.presets ?? defaultMetricsRangePresets;
  let intervals = opts.intervals ?? defaultMetricsIntervals;

  let from = parseDate(readParam(params, keys.from));
  let to = parseDate(readParam(params, keys.to));
  let preset = readParam(params, keys.range);
  let interval = readParam(params, keys.interval);

  let range: MetricsRange = fallback.range;
  if (from && to && from < to) range = { type: 'custom', from, to };
  else if (preset && presets.some(candidate => candidate.id == preset)) {
    range = { type: 'preset', preset };
  }

  let knownInterval = intervals.find(candidate => candidate.id == interval);

  return {
    range,
    interval: knownInterval?.id ?? fallback.interval
  };
};

export let serializeMetricsQuery = (
  query: MetricsQuery,
  opts: { keys?: Partial<MetricsQueryParamKeys> } = {}
): Record<string, string | undefined> => {
  let keys = { ...defaultMetricsQueryParamKeys, ...opts.keys };

  return {
    [keys.range]: query.range.type == 'preset' ? query.range.preset : undefined,
    [keys.from]: query.range.type == 'custom' ? query.range.from.toISOString() : undefined,
    [keys.to]: query.range.type == 'custom' ? query.range.to.toISOString() : undefined,
    [keys.interval]: query.interval == autoMetricsInterval ? undefined : query.interval
  };
};

export let applyMetricsQuery = (
  params: URLSearchParams,
  query: MetricsQuery,
  opts: { keys?: Partial<MetricsQueryParamKeys> } = {}
) => {
  let next = new URLSearchParams(params);

  for (let [key, value] of Object.entries(serializeMetricsQuery(query, opts))) {
    if (value === undefined) next.delete(key);
    else next.set(key, value);
  }

  return next;
};
