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

// Without usage an amount is 0; with usage it is null only when none of it had one. Turn-level
// usage has tokens but no requests.
export let spendFiguresOf = (cells: Cells | null | undefined): AgentTrackingSpendFigures => {
  let row = cells ?? {};
  let requests = countOf(row.requests);
  let tokens = tokensOf(row.tokens);
  let requestsWithoutCost = countOf(row.requests_without_cost);
  let requestsWithoutListPrice = countOf(row.requests_without_list_price);
  let idle = requests == 0 && tokens.total == 0;
  let amount = (value: unknown) => (idle ? (value ?? 0) : value);
  let uncovered = (requestsWithout: number, tokensWithout: unknown) =>
    !idle && requestsWithout >= requests && countOf(tokensWithout) >= tokens.total;

  return {
    cost: {
      ...costOf({
        total: amount(row['cost.usd']),
        listPrice: amount(row['cost.list']),
        reported: row['cost.reported'],
        unpriced: uncovered(requestsWithoutCost, row.tokens_without_cost),
        unpricedAtListPrice: uncovered(requestsWithoutListPrice, row.tokens_without_list_price)
      }),
      requestsWithoutCost,
      requestsWithoutListPrice
    },
    requests,
    tokens
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

// A session counts fully in each of its repositories and tickets, so their sum can exceed the
// total spend; a share is always of the total.
export let shareOfTotalCost = (row: Cells, totals: Cells | null | undefined) => {
  let cost = toNanos(row['cost.usd']);
  let total = toNanos(totals?.['cost.usd']);
  if (cost === null || !total) return null;

  return Number(cost) / Number(total);
};

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
