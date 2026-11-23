import {
  deserializeFromQuery,
  f,
  getFilterPayload,
  readFilterPayload
} from '@metorial/data-list';
import { useSearchParams } from 'react-router-dom';

let agentTrackingRangePresets = [
  { id: 'today', label: 'Today' },
  { id: 'last_7_days', label: '7 Days' },
  { id: 'last_30_days', label: '30 Days' },
  { id: 'month_to_date', label: 'Month to Date' },
  { id: 'last_month', label: 'Last Month' }
] as const;

export type AgentTrackingRangePreset = (typeof agentTrackingRangePresets)[number]['id'];

export let defaultAgentTrackingRange: AgentTrackingRangePreset = 'last_30_days';

export let getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

let spendRangeHighlight = {
  exclusive: true,
  preserveOrder: true,
  defaultValue: defaultAgentTrackingRange
} as const;

export let spendRangeFilter = f.select('range', 'Range', agentTrackingRangePresets, {
  highlight: spendRangeHighlight
});

// With individuals hidden the API counts whole UTC days up to yesterday, so Today is not offered.
export let hiddenIndividualsSpendRangeFilter = f.select(
  'range',
  'Range',
  agentTrackingRangePresets.filter(preset => preset.id != 'today'),
  { highlight: spendRangeHighlight }
);

export let lastActiveRangeFilter = f.select(
  'range',
  'Last Active',
  agentTrackingRangePresets,
  {
    description: 'Filter by last activity',
    highlight: { exclusive: true, label: 'Last Active', preserveOrder: true }
  }
);

export let lastActiveRangeQuery = (range: AgentTrackingRangePreset | undefined) => ({
  range,
  timeZone: range ? getBrowserTimeZone() : undefined
});

export let useLastActiveRange = () => {
  let [params] = useSearchParams();
  let payload = getFilterPayload(deserializeFromQuery(params, [lastActiveRangeFilter.filter]));

  return lastActiveRangeQuery(readFilterPayload(lastActiveRangeFilter, payload)?.[0]);
};

export let withQuery = (
  path: string,
  query: Record<string, string | string[] | undefined>
) => {
  let params = new URLSearchParams();
  for (let [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, Array.isArray(value) ? value.join(',') : value);
  }

  let search = params.toString();
  return search ? `${path}?${search}` : path;
};

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
