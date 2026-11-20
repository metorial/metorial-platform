import { useSearchParams } from 'react-router-dom';

export let agentTrackingRangePresets = [
  { id: 'today', label: 'Today' },
  { id: 'last_7_days', label: '7 Days' },
  { id: 'last_30_days', label: '30 Days' },
  { id: 'month_to_date', label: 'Month to Date' },
  { id: 'last_month', label: 'Last Month' }
] as const;

export type AgentTrackingRangePreset = (typeof agentTrackingRangePresets)[number]['id'];

let defaultPreset: AgentTrackingRangePreset = 'last_30_days';

export let useSearchParamOption = <Id extends string>(
  name: string,
  ids: readonly Id[],
  defaultId: Id
) => {
  let [params, setParams] = useSearchParams();
  let value = params.get(name);
  let current = ids.find(id => id == value) ?? defaultId;

  let setCurrent = (next: Id) => {
    let updated = new URLSearchParams(params);
    if (next == defaultId) updated.delete(name);
    else updated.set(name, next);
    setParams(updated, { replace: true });
  };

  return [current, setCurrent] as const;
};

export let getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

// With individuals hidden the service counts whole UTC days up to yesterday only.
export let useAgentTrackingRange = (opts: { individualsHidden?: boolean } = {}) => {
  let presets = opts.individualsHidden
    ? agentTrackingRangePresets.filter(preset => preset.id != 'today')
    : agentTrackingRangePresets;
  let [range, setRange] = useSearchParamOption(
    'range',
    presets.map(preset => preset.id),
    defaultPreset
  );

  return {
    range,
    setRange,
    presets,
    timeZone: opts.individualsHidden ? 'UTC' : getBrowserTimeZone()
  };
};

// `to` is exclusive, so the last day shown is the one that contains the instant before it.
export let formatAgentTrackingRange = (range: { from: Date; to: Date; timeZone: string }) => {
  let format = (date: Date) => {
    try {
      return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: range.timeZone
      }).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  };

  let first = format(new Date(range.from));
  let last = format(new Date(new Date(range.to).getTime() - 1));

  return first == last ? first : `${first} – ${last}`;
};
