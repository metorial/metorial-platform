import { unknownMemberKey } from './members';
import { costOf, countOf, toNanos, tokensOf } from './money';
import { memberCountColumn, sessionCountColumn } from './queries';
import { calendarDateOfKey } from './range';
import type {
  AgentTrackingDayCounts,
  AgentTrackingModel,
  AgentTrackingSpendDay,
  AgentTrackingSpendFigures
} from './types';

export type Cells = Record<string, unknown>;

type Labels = Record<string, { name?: string | null }>;

// Without requests an amount is 0; with requests it is null only when none of them had one.
export let spendFiguresOf = (cells: Cells | null | undefined): AgentTrackingSpendFigures => {
  let row = cells ?? {};
  let requests = countOf(row.requests);
  let requestsWithoutCost = countOf(row.requests_without_cost);
  let requestsWithoutListPrice = countOf(row.requests_without_list_price);
  let idle = requests == 0;
  let amount = (value: unknown) => (idle ? (value ?? 0) : value);

  return {
    cost: {
      ...costOf({
        total: amount(row['cost.usd']),
        listPrice: amount(row['cost.list']),
        reported: row['cost.reported'],
        unpriced: !idle && requestsWithoutCost >= requests,
        unpricedAtListPrice: !idle && requestsWithoutListPrice >= requests
      }),
      requestsWithoutCost,
      requestsWithoutListPrice
    },
    requests,
    tokens: tokensOf(row.tokens)
  };
};

export let dayCountsOf = (cells: Cells | null | undefined): AgentTrackingDayCounts => ({
  sessions: countOf(cells?.[sessionCountColumn]),
  members: countOf(cells?.[memberCountColumn])
});

// Requests, tokens or a cost. A cost the client only reported is not usage here.
export let hasUsage = (row: Cells) =>
  countOf(row.requests) > 0 ||
  tokensOf(row.tokens).total > 0 ||
  (toNanos(row['cost.usd']) ?? 0n) !== 0n;

export let dayItem = (row: Cells): AgentTrackingSpendDay | null => {
  let key = row['time.day'];
  if (typeof key != 'string' || Number.isNaN(new Date(key).getTime())) return null;

  return {
    date: calendarDateOfKey(key),
    startsAt: new Date(key),
    hidden: false,
    ...spendFiguresOf(row),
    counts: dayCountsOf(row)
  };
};

let shareOf = (value: unknown) =>
  typeof value == 'number' && Number.isFinite(value) ? value : null;

export let usageItem = <Kind extends string>(
  row: Cells,
  item: {
    kind: Kind;
    key: string;
    model?: AgentTrackingModel;
    unknownModelNames?: string[];
  }
) => ({
  model: null,
  unknownModelNames: [],
  ...item,
  ...spendFiguresOf(row),
  share: shareOf(row.share)
});

export let modelUsageItem = (row: Cells, labels: Labels, unknownModelNames: string[]) => {
  let value = row.model;

  return typeof value == 'string'
    ? usageItem(row, {
        kind: 'model' as const,
        key: value,
        model: { id: value, name: labels[value]?.name ?? null }
      })
    : usageItem(row, { kind: 'unknown' as const, key: unknownMemberKey, unknownModelNames });
};
