import { ServiceError } from '@lowerdeck/error';
import type { AgentTrackingPrivacy } from '@metorial/module-agent-tracking-sync';
import { countOf, sumMoney, toNanos } from './money';
import { individualsHiddenError } from './privacy';
import { memberCountColumn } from './queries';
import {
  calendarDateIn,
  dayMs,
  defaultRangePreset,
  resolveRange,
  startOfDayIn,
  type RangeInput,
  type ResolvedRange
} from './range';
import { dayItem, hasUsage, type Cells } from './spend';
import type { AgentTrackingSpendDay, AgentTrackingSpendFilters } from './types';

export let privateTimeZone = 'UTC';

let windowDays = { last_7_days: 7, last_30_days: 30 } as const;

export let filtersHiddenError = individualsHiddenError({
  message:
    'This organization hides individual data in agent usage, so spend cannot be filtered by model or client: a filtered total can single out the few people who use one.'
});

export let seatValuesHiddenError = individualsHiddenError({
  message:
    'This organization hides individual data in agent usage, so seat values are not listed: a seat can single out the few people who hold it.'
});

export let breakdownHiddenError = individualsHiddenError({
  message:
    'This organization hides individual data in agent usage, so spend is not broken down by model or member: a model can be used by too few people on some days.'
});

let rangeHiddenError = individualsHiddenError({
  message:
    'This organization hides individual data in agent usage, so only the preset ranges of whole days up to yesterday are available, not today and not explicit ranges.'
});

export let assertPrivateRead = (d: {
  range: RangeInput;
  filters: AgentTrackingSpendFilters;
}) => {
  if (d.filters.memberIds?.length) throw new ServiceError(individualsHiddenError);
  if (d.filters.clientFamilies?.length || d.filters.modelIds?.length) {
    throw new ServiceError(filtersHiddenError);
  }
  if (d.range.from || d.range.to || d.range.preset == 'today') {
    throw new ServiceError(rangeHiddenError);
  }
};

export let privateRange = (
  preset: RangeInput['preset'],
  now: Date = new Date()
): ResolvedRange | null => {
  let name = preset ?? defaultRangePreset;
  let today = startOfDayIn(calendarDateIn(now, privateTimeZone), privateTimeZone);
  let resolved = resolveRange(
    { preset: name, from: null, to: null, timeZone: privateTimeZone },
    now
  );

  let range =
    name == 'last_7_days' || name == 'last_30_days'
      ? { ...resolved, from: new Date(today.getTime() - windowDays[name] * dayMs), to: today }
      : name == 'month_to_date'
        ? { ...resolved, to: today }
        : resolved;

  return range.to > range.from ? range : null;
};

export let emptyPrivateRange = (preset: RangeInput['preset'], now: Date): ResolvedRange => {
  let today = startOfDayIn(calendarDateIn(now, privateTimeZone), privateTimeZone);

  return {
    preset: preset ?? defaultRangePreset,
    from: today,
    to: today,
    timeZone: privateTimeZone
  };
};

let utcDays = (range: { from: Date; to: Date }) => {
  let days: { date: string; startsAt: Date }[] = [];
  for (let at = range.from.getTime(); at < range.to.getTime(); at += dayMs) {
    let startsAt = new Date(at);
    days.push({ date: startsAt.toISOString().slice(0, 10), startsAt });
  }

  return days;
};

let hasReportedCost = (reported: unknown) =>
  Array.isArray(reported) &&
  reported.some(entry => {
    let amount = toNanos((entry as { amount?: unknown })?.amount);
    return amount !== null && amount !== 0n;
  });

// Metorial applies the group minimum itself, whatever the engine's setting. A reported cost
// without a request still counts as usage.
let isShownGroup = (privacy: AgentTrackingPrivacy, row: Cells) =>
  !(hasUsage(row) || hasReportedCost(row['cost.reported'])) ||
  countOf(row[memberCountColumn]) >= privacy.minGroupUsers;

let addNumbers = (a: unknown, b: unknown) => {
  let numeric = [a, b].filter(
    (value): value is number => typeof value == 'number' && Number.isFinite(value)
  );

  return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) : null;
};

let addObjects = (a: unknown, b: unknown) => {
  let sum: Record<string, unknown> = {};
  for (let part of [a, b]) {
    if (!part || typeof part != 'object') continue;
    for (let [key, value] of Object.entries(part as Record<string, unknown>)) {
      sum[key] = addNumbers(sum[key], value);
    }
  }

  return sum;
};

export let sumSpendCells = (rows: Cells[]): Cells => {
  let total: Cells = {
    'cost.usd': sumMoney(rows.map(row => row['cost.usd'])),
    'cost.list': sumMoney(rows.map(row => row['cost.list'])),
    'cost.reported': rows.flatMap(row =>
      Array.isArray(row['cost.reported']) ? row['cost.reported'] : []
    ),
    tokens: {}
  };

  for (let row of rows) {
    for (let column of [
      'requests',
      'requests_without_cost',
      'requests_without_list_price',
      'tokens_without_cost',
      'tokens_without_list_price'
    ]) {
      total[column] = addNumbers(total[column], row[column]);
    }
    total.tokens = addObjects(total.tokens, row.tokens);
  }

  return total;
};

export let privateDays = (d: {
  range: ResolvedRange;
  rows: Cells[];
  privacy: AgentTrackingPrivacy;
}) => {
  let byDate = new Map(
    d.rows.flatMap(row => {
      let item = dayItem(row);
      return item ? [[item.date, { row, item }] as const] : [];
    })
  );

  let days = utcDays(d.range).map(day => {
    let found = byDate.get(day.date);
    if (found && isShownGroup(d.privacy, found.row)) return found;

    let hidden: AgentTrackingSpendDay = {
      ...day,
      hidden: true,
      cost: null,
      requests: null,
      tokens: null,
      counts: null
    };
    return { row: null, item: hidden };
  });
  let shownRows = days.flatMap(day => (day.row ? [day.row] : []));

  return {
    items: days.map(day => day.item),
    anyHidden: shownRows.length < days.length,
    total: sumSpendCells(shownRows)
  };
};
