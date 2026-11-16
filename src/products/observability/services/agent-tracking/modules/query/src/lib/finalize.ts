import {
  bucketsBetween,
  type Expr,
  evaluateExpr,
  type Filter,
  formatInZone,
  type WindowExpr
} from '@mtsrc/agent-tracking-query-spec';
import { dayNames } from '../catalog';
import {
  accumulatorName,
  binLabels,
  keyName,
  maxDistinctValues,
  maxGroups,
  rawKeyName
} from './codegen';
import { type MappedContext, mapValue } from './mapped';
import type { QueryPlan } from './plan';
import type {
  AggregateMeasure,
  BoundDimension,
  BoundMeasure,
  BoundQuery,
  QueryWarning
} from './types';

export let otherValue = '$other';

export type RawGroup = { _id: Record<string, unknown> } & Record<string, unknown>;

export type RawReportedGroup = { _id: Record<string, unknown>; amount: number };

export type ScanResult = {
  groups: RawGroup[];
  reported: Map<string, RawReportedGroup[]>;
  truncated?: boolean;
};

export type FinalizeInput = {
  query: BoundQuery;
  plan: QueryPlan;
  main: ScanResult;
  compare?: ScanResult;
  totals?: ScanResult;
  mapped: MappedContext | null;
  groupValues?: string[];
};

export type Column = {
  name: string;
  role: 'dimension' | 'measure' | 'derived' | 'compare';
  type: string;
  entityKind?: string;
  unit?: string;
  additive?: boolean;
  format?: string;
};

export type ReportedAmount = { unit: string; basis: string | null; amount: number };

export type CellValue =
  string | number | boolean | null | Record<string, number | null> | ReportedAmount[];

export type FinalResult = {
  columns: Column[];
  rows: Record<string, CellValue>[];
  totals: Record<string, CellValue> | null;
  truncated: boolean;
  warnings: QueryWarning[];
};

type State =
  | { t: 'sum'; v: number }
  | { t: 'avg'; s: number; n: number }
  | { t: 'min' | 'max'; v: number | null }
  | { t: 'set'; values: Set<string>; capped: boolean }
  | { t: 'pct'; v: number | null; merged: boolean }
  | { t: 'reported'; amounts: Map<string, number> };

type Group = {
  dims: unknown[];
  states: Map<string, State>;
  filled: boolean;
  values: Map<string, CellValue>;
};

let round = (value: number) => Math.round(value * 1e9) / 1e9;

let isTime = (dimension: BoundDimension) => dimension.field.source.kind == 'time';

let identity = (dims: unknown[]) => JSON.stringify(dims);

let warn = (warnings: QueryWarning[], code: string, message: string) => {
  if (!warnings.some(warning => warning.code == code)) warnings.push({ code, message });
};

let numberOf = (value: unknown) => {
  if (typeof value == 'number') return Number.isFinite(value) ? value : null;
  if (value && typeof value == 'object' && 'total' in value) {
    let total = (value as { total: unknown }).total;
    return typeof total == 'number' ? total : null;
  }

  return null;
};

let stringify = (value: unknown) =>
  value === null || value === undefined ? null : String(value);

let normalizeDim = (
  dimension: BoundDimension,
  key: Record<string, unknown>,
  index: number,
  mapped: MappedContext | null,
  preMapped: boolean
): unknown => {
  let value = key[keyName(index)];
  let source = dimension.field.source;

  if (value === undefined) value = null;
  if (value instanceof Date) return value.getTime();
  if (source.kind == 'mapped' && !preMapped && mapped) {
    return mapValue(
      source,
      { value: stringify(value), raw: stringify(key[rawKeyName(index)]) },
      mapped
    );
  }

  return value;
};

let reportedKey = (unit: unknown, basis: unknown) => `${unit ?? ''}\u0000${basis ?? ''}`;

let stateOf = (
  measure: AggregateMeasure,
  raw: Record<string, unknown>,
  index: number
): State => {
  let value = raw[accumulatorName(index)];

  switch (measure.fn) {
    case 'sum':
    case 'count':
      return { t: 'sum', v: Number(value ?? 0) };
    case 'avg':
      return {
        t: 'avg',
        s: Number(value ?? 0),
        n: Number(raw[`${accumulatorName(index)}_n`] ?? 0)
      };
    case 'min':
    case 'max':
      return { t: measure.fn, v: typeof value == 'number' ? value : null };
    case 'countDistinct': {
      let items = (Array.isArray(value) ? value : []).flat();
      let values = new Set(
        items.filter(item => item !== null && item !== undefined).map(String)
      );
      return {
        t: 'set',
        values,
        capped: Array.isArray(value) && value.length > maxDistinctValues
      };
    }
    case 'percentile': {
      let first = Array.isArray(value) ? value[0] : value;
      return { t: 'pct', v: typeof first == 'number' ? first : null, merged: false };
    }
  }
};

let mergeState = (a: State, b: State): State => {
  if (a.t == 'sum' && b.t == 'sum') return { t: 'sum', v: a.v + b.v };
  if (a.t == 'avg' && b.t == 'avg') return { t: 'avg', s: a.s + b.s, n: a.n + b.n };
  if ((a.t == 'min' || a.t == 'max') && a.t == b.t) {
    let items = [a.v, b.v].filter((item): item is number => item !== null);
    return {
      t: a.t,
      v: items.length ? (a.t == 'min' ? Math.min(...items) : Math.max(...items)) : null
    };
  }
  if (a.t == 'set' && b.t == 'set') {
    return {
      t: 'set',
      values: new Set([...a.values, ...b.values]),
      capped: a.capped || b.capped
    };
  }
  if (a.t == 'reported' && b.t == 'reported') {
    let amounts = new Map(a.amounts);
    for (let [key, amount] of b.amounts) amounts.set(key, (amounts.get(key) ?? 0) + amount);
    return { t: 'reported', amounts };
  }

  return { t: 'pct', v: null, merged: true };
};

let mergeInto = (target: Group, source: Group) => {
  for (let [name, state] of source.states) {
    let existing = target.states.get(name);
    target.states.set(name, existing ? mergeState(existing, state) : state);
  }
  target.filled = target.filled && source.filled;
};

let emptyGroup = (dims: unknown[], filled: boolean): Group => ({
  dims,
  states: new Map(),
  filled,
  values: new Map()
});

let decode = (
  input: FinalizeInput,
  result: ScanResult,
  warnings: QueryWarning[]
): Map<string, Group> => {
  let { query, plan } = input;
  let groups = new Map<string, Group>();

  let add = (key: Record<string, unknown>, apply: (group: Group) => void) => {
    let dims = query.dimensions.map((dimension, index) =>
      normalizeDim(dimension, key, index, input.mapped, plan.mappingTables)
    );
    let group = emptyGroup(dims, false);
    apply(group);

    let id = identity(dims);
    let existing = groups.get(id);
    if (existing) mergeInto(existing, group);
    else groups.set(id, group);
  };

  for (let raw of result.groups) {
    add(raw._id, group => {
      plan.aggregates.forEach((measure, index) =>
        group.states.set(measure.name, stateOf(measure, raw, index))
      );
    });
  }

  for (let [name, rows] of result.reported) {
    for (let row of rows) {
      let { unit, basis, ...key } = row._id;
      add(key, group => {
        group.states.set(name, {
          t: 'reported',
          amounts: new Map([[reportedKey(unit, basis), Number(row.amount ?? 0)]])
        });
      });
    }
  }

  for (let group of groups.values()) {
    for (let state of group.states.values()) {
      if (state.t == 'pct' && state.merged) {
        warn(
          warnings,
          'percentile_merged',
          'Some percentiles span groups that merged after mapping and are null.'
        );
      }
    }
  }

  return groups;
};

let aggregateValue = (
  measure: AggregateMeasure,
  state: State | undefined,
  zero: boolean,
  warnings: QueryWarning[]
): CellValue => {
  if (!state) return zero && ['sum', 'count', 'countDistinct'].includes(measure.fn) ? 0 : null;

  switch (state.t) {
    case 'sum':
      return round(state.v);
    case 'avg':
      return state.n > 0 ? round(state.s / state.n) : null;
    case 'min':
    case 'max':
      return state.v === null ? null : round(state.v);
    case 'set':
      if (state.capped || state.values.size > maxDistinctValues) {
        warn(
          warnings,
          'distinct_capped',
          `Distinct counts stop at ${maxDistinctValues} per group.`
        );
        return maxDistinctValues;
      }
      return state.values.size;
    case 'pct':
      return state.v === null ? null : round(state.v);
    default:
      return null;
  }
};

let reportedValue = (state: State | undefined, warnings: QueryWarning[]): ReportedAmount[] => {
  if (state?.t != 'reported') return [];

  let amounts = [...state.amounts].map(([key, amount]) => {
    let [unit, basis] = key.split('\u0000');
    return { unit: unit!, basis: basis || null, amount: round(amount) };
  });
  if (new Set(amounts.map(amount => amount.unit)).size > 1) {
    warn(warnings, 'mixed_units', 'Reported cost uses several units, which never convert.');
  }

  return amounts.sort(
    (a, b) => a.unit.localeCompare(b.unit) || String(a.basis).localeCompare(String(b.basis))
  );
};

type Context = {
  query: BoundQuery;
  warnings: QueryWarning[];
  zero: boolean;
  timeIndex: number;
};

let seriesKey = (ctx: Context, group: Group) =>
  identity(group.dims.filter((_, index) => index != ctx.timeIndex));

let timeOf = (ctx: Context, group: Group) =>
  ctx.timeIndex >= 0 ? (group.dims[ctx.timeIndex] as number | null) : null;

let computeBase = (ctx: Context, groups: Group[]) => {
  for (let group of groups) {
    let zero = ctx.zero || group.filled;

    for (let measure of ctx.query.measures) {
      if (measure.kind == 'aggregate') {
        group.values.set(
          measure.name,
          aggregateValue(measure, group.states.get(measure.name), zero, ctx.warnings)
        );
      } else if (measure.kind == 'reported') {
        group.values.set(
          measure.name,
          reportedValue(group.states.get(measure.name), ctx.warnings)
        );
      }
    }
    for (let measure of ctx.query.measures) {
      if (measure.kind != 'composite') continue;

      let parts: Record<string, number | null> = {};
      let total = 0;
      let any = false;
      for (let [part, name] of Object.entries(measure.parts)) {
        let value = numberOf(group.values.get(name));
        parts[part] = value;
        if (value !== null) {
          total += value;
          any = true;
        }
      }
      if (measure.total) parts.total = any ? round(total) : null;
      group.values.set(measure.name, parts);
    }
  }
};

let windowEvaluator = (ctx: Context, groups: Group[]) => {
  let cache = new Map<string, Map<Group, number | null>>();
  let valueOf = (group: Group, name: string) => numberOf(group.values.get(name));
  let sumOf = (items: Group[], name: string) =>
    items.reduce((total, item) => total + (valueOf(item, name) ?? 0), 0);

  let compute = (expr: WindowExpr): Map<Group, number | null> => {
    let result = new Map<Group, number | null>();

    if ('shareOfTotal' in expr) {
      let total = sumOf(groups, expr.shareOfTotal);
      for (let group of groups) {
        let value = valueOf(group, expr.shareOfTotal);
        result.set(group, value === null || total == 0 ? null : value / total);
      }
    } else if ('shareWithin' in expr) {
      let [name, dimensionName] = expr.shareWithin;
      let index = ctx.query.dimensions.findIndex(dimension => dimension.name == dimensionName);
      let totals = new Map<string, number>();
      for (let group of groups) {
        let key = identity([group.dims[index]]);
        totals.set(key, (totals.get(key) ?? 0) + (valueOf(group, name) ?? 0));
      }
      for (let group of groups) {
        let value = valueOf(group, name);
        let total = totals.get(identity([group.dims[index]])) ?? 0;
        result.set(group, value === null || total == 0 ? null : value / total);
      }
    } else if ('cumulative' in expr || 'movingAvg' in expr) {
      let name = 'cumulative' in expr ? expr.cumulative : expr.movingAvg[0];
      let series = new Map<string, Group[]>();
      for (let group of groups) {
        let key = seriesKey(ctx, group);
        series.set(key, [...(series.get(key) ?? []), group]);
      }
      for (let items of series.values()) {
        items.sort((a, b) => (timeOf(ctx, a) ?? 0) - (timeOf(ctx, b) ?? 0));

        if ('cumulative' in expr) {
          let running = 0;
          for (let group of items) {
            running += valueOf(group, name) ?? 0;
            result.set(group, running);
          }
        } else {
          let size = expr.movingAvg[1];
          items.forEach((group, index) => {
            let window = items
              .slice(Math.max(0, index - size + 1), index + 1)
              .map(item => valueOf(item, name))
              .filter((value): value is number => value !== null);
            result.set(
              group,
              window.length ? window.reduce((a, b) => a + b, 0) / window.length : null
            );
          });
        }
      }
    } else {
      let buckets = new Map<string, Group[]>();
      for (let group of groups) {
        let key = String(timeOf(ctx, group));
        buckets.set(key, [...(buckets.get(key) ?? []), group]);
      }
      for (let items of buckets.values()) {
        let ranked = items
          .map(group => ({ group, value: valueOf(group, expr.rank) }))
          .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
        ranked.forEach((item, index) =>
          result.set(item.group, item.value === null ? null : index + 1)
        );
      }
    }

    return result;
  };

  return (expr: WindowExpr, group: Group) => {
    let key = JSON.stringify(expr);
    let values = cache.get(key);
    if (!values) {
      values = compute(expr);
      cache.set(key, values);
    }

    return values.get(group) ?? null;
  };
};

let computeDerived = (ctx: Context, groups: Group[]) => {
  let window = windowEvaluator(ctx, groups);

  for (let measure of ctx.query.measures) {
    if (measure.kind != 'derived') continue;

    for (let group of groups) {
      let value = evaluateExpr(measure.expr, {
        value: name => numberOf(group.values.get(name)),
        window: expr => window(expr, group)
      });
      group.values.set(
        measure.name,
        value === null || !Number.isFinite(value) ? null : round(value)
      );
    }
  }
};

let computeValues = (ctx: Context, groups: Group[]) => {
  computeBase(ctx, groups);
  computeDerived(ctx, groups);
};

let fillTime = (ctx: Context, groups: Map<string, Group>) => {
  let { query } = ctx;
  let dimension = query.dimensions[ctx.timeIndex];
  if (!query.fill.time || !dimension || dimension.field.source.kind != 'time') return;

  let buckets = bucketsBetween(
    query.range,
    dimension.field.source.unit,
    query.timeZone,
    maxGroups
  );
  let series = new Map<string, unknown[]>();
  for (let group of groups.values()) series.set(seriesKey(ctx, group), group.dims);
  if (!series.size && query.dimensions.length == 1) series.set('[]', [null]);

  for (let dims of series.values()) {
    for (let bucket of buckets) {
      let filled = [...dims];
      filled[ctx.timeIndex] = bucket.getTime();

      let id = identity(filled);
      if (!groups.has(id)) groups.set(id, emptyGroup(filled, query.fill.time == 'zero'));
    }
  }
};

let fillGroups = (ctx: Context, groups: Map<string, Group>, values: string[] | undefined) => {
  if (!ctx.query.fill.groups || !values) return;

  let index = ctx.query.dimensions.findIndex(dimension => !isTime(dimension));
  let present = new Set([...groups.values()].map(group => group.dims[index]));
  let times =
    ctx.timeIndex >= 0
      ? [...new Set([...groups.values()].map(group => timeOf(ctx, group)))]
      : [null];

  for (let value of values) {
    if (present.has(value)) continue;

    for (let time of times) {
      let dims = ctx.query.dimensions.map(() => null as unknown);
      dims[index] = value;
      if (ctx.timeIndex >= 0) dims[ctx.timeIndex] = time;
      groups.set(identity(dims), emptyGroup(dims, true));
    }
  }
};

let previousColumns = (name: string) => ({
  previous: `${name}@previous`,
  delta: `${name}@delta`,
  change: `${name}@change`
});

let joinCompare = (ctx: Context, groups: Group[], compared: Group[]) => {
  let { query } = ctx;
  let offset = new Map<number, number>();
  let dimension = query.dimensions[ctx.timeIndex];

  if (dimension?.field.source.kind == 'time' && query.compare) {
    let unit = dimension.field.source.unit;
    let main = bucketsBetween(query.range, unit, query.timeZone, maxGroups);
    let previous = bucketsBetween(query.compare, unit, query.timeZone, maxGroups);
    previous.forEach((bucket, index) => {
      if (main[index]) offset.set(bucket.getTime(), main[index]!.getTime());
    });
  }

  let byKey = new Map<string, Group>();
  for (let group of compared) {
    let dims = [...group.dims];
    if (ctx.timeIndex >= 0) {
      let aligned = offset.get(dims[ctx.timeIndex] as number);
      if (aligned === undefined) continue;
      dims[ctx.timeIndex] = aligned;
    }
    byKey.set(identity(dims), group);
  }

  let visible = query.measures.filter(measure => !measure.hidden);
  for (let group of groups) {
    let previous = byKey.get(identity(group.dims));

    for (let measure of visible) {
      let columns = previousColumns(measure.name);
      let before =
        previous?.values.get(measure.name) ?? (measure.kind == 'reported' ? [] : null);
      let current = numberOf(group.values.get(measure.name));
      let prior = numberOf(before);
      let delta = current !== null && prior !== null ? round(current - prior) : null;

      group.values.set(columns.previous, before);
      group.values.set(columns.delta, delta);
      group.values.set(columns.change, delta !== null && prior ? round(delta / prior) : null);
    }
  }
};

let cellOf = (ctx: Context, group: Group, column: string): unknown => {
  let index = ctx.query.dimensions.findIndex(dimension => dimension.name == column);
  if (index >= 0) return group.dims[index];
  if (column == 'time' && ctx.timeIndex >= 0) return group.dims[ctx.timeIndex];

  return group.values.get(column);
};

let matchesHaving = (ctx: Context, filter: Filter, group: Group): boolean => {
  if ('and' in filter) return filter.and.every(item => matchesHaving(ctx, item, group));
  if ('or' in filter) return filter.or.some(item => matchesHaving(ctx, item, group));
  if ('not' in filter) return !matchesHaving(ctx, filter.not, group);

  let value = numberOf(cellOf(ctx, group, filter.field));
  let list = Array.isArray(filter.value) ? filter.value : [filter.value];
  let target = Number(list[0]);

  switch (filter.op) {
    case 'isNull':
      return value === null;
    case 'notNull':
      return value !== null;
    case 'eq':
      return value === target;
    case 'neq':
      return value !== target;
    case 'in':
      return value !== null && list.map(Number).includes(value);
    case 'notIn':
      return value === null || !list.map(Number).includes(value);
    case 'gt':
      return value !== null && value > target;
    case 'gte':
      return value !== null && value >= target;
    case 'lt':
      return value !== null && value < target;
    case 'lte':
      return value !== null && value <= target;
    case 'between':
      return value !== null && value >= target && value <= Number(list[1]);
    default:
      return false;
  }
};

let sortKeyOf = (ctx: Context, column: string, value: unknown) => {
  let index = ctx.query.dimensions.findIndex(dimension => dimension.name == column);
  let bins = index >= 0 ? ctx.query.dimensions[index]!.bins : undefined;
  if (bins && typeof value == 'string') return binLabels(bins).indexOf(value);

  return numberOf(value) ?? value;
};

let compareValues = (a: unknown, b: unknown) => {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (a === otherValue) return 1;
  if (b === otherValue) return -1;
  if (typeof a == 'number' && typeof b == 'number') return a - b;

  return String(a).localeCompare(String(b));
};

let orderOf = (ctx: Context) => {
  let { query } = ctx;
  if (query.orderBy.length) return query.orderBy;

  let first = query.measures.find(measure => !measure.hidden && measure.kind != 'reported');
  return [
    ...(ctx.timeIndex >= 0 ? [{ by: 'time', direction: 'asc' as const }] : []),
    ...(first ? [{ by: first.name, direction: 'desc' as const }] : [])
  ];
};

let comparator =
  (ctx: Context, order: { by: string; direction: 'asc' | 'desc' }[]) =>
  (a: Group, b: Group) => {
    for (let { by, direction } of order) {
      let left = sortKeyOf(ctx, by, cellOf(ctx, a, by));
      let right = sortKeyOf(ctx, by, cellOf(ctx, b, by));
      let nullish = (value: unknown) => value === null || value === undefined;

      if (nullish(left) || nullish(right)) {
        let result = compareValues(left, right);
        if (result) return result;
        continue;
      }

      let result = compareValues(left, right);
      if (result) return direction == 'asc' ? result : -result;
    }

    return compareValues(identity(a.dims), identity(b.dims));
  };

let mergeToOther = (ctx: Context, groups: Group[]) => {
  let others = new Map<string, Group>();

  for (let group of groups) {
    let dims = group.dims.map((value, index) => (index == ctx.timeIndex ? value : otherValue));
    let id = identity(dims);
    let other = others.get(id);
    if (!other) {
      other = emptyGroup(dims, group.filled);
      others.set(id, other);
    }
    mergeInto(other, group);
  }

  return [...others.values()];
};

let suppressSmallGroups = (ctx: Context, input: FinalizeInput, groups: Group[]) => {
  let name = input.plan.usersMeasure;
  if (!name) return groups;

  let minimum = ctx.query.privacy.minGroupUsers;
  let usersOf = (group: Group) => {
    let state = group.states.get(name);
    return state?.t == 'set' ? state.values.size : 0;
  };
  let small = groups.filter(group => !group.filled && usersOf(group) < minimum);
  if (!small.length) return groups;

  warn(
    ctx.warnings,
    'k_anonymity_suppressed',
    `Groups with fewer than ${minimum} people were merged into "${otherValue}".`
  );

  let others = mergeToOther(ctx, small).filter(group => usersOf(group) >= minimum);
  let result = [...groups.filter(group => !small.includes(group)), ...others];
  computeBase(ctx, others);
  computeDerived(ctx, result);

  return result;
};

let cut = (ctx: Context, groups: Group[]) => {
  let { query } = ctx;
  let order = orderOf(ctx);
  let sort = comparator(ctx, order);
  let hasSeries = ctx.timeIndex >= 0 && query.dimensions.length > 1;

  if (!hasSeries) {
    let sorted = [...groups].sort(sort);
    let kept = sorted.slice(0, query.limit);
    let rest = sorted.slice(query.limit);
    if (!rest.length) return { groups: kept, truncated: false };
    if (!query.other) return { groups: kept, truncated: true };

    let others = mergeToOther(ctx, rest);
    return { groups: [...kept, ...others], truncated: false, merged: others };
  }

  let rankBy = order.find(item => item.by != 'time') ?? { by: '', direction: 'desc' as const };
  let totals = new Map<string, { key: string; total: number; sample: Group }>();
  for (let group of groups) {
    let key = seriesKey(ctx, group);
    let entry = totals.get(key) ?? { key, total: 0, sample: group };
    entry.total += numberOf(group.values.get(rankBy.by)) ?? 0;
    totals.set(key, entry);
  }

  let ranked = [...totals.values()].sort(
    (a, b) =>
      (rankBy.direction == 'asc' ? a.total - b.total : b.total - a.total) ||
      a.key.localeCompare(b.key)
  );
  let keep = new Set(ranked.slice(0, query.limit).map(entry => entry.key));
  let kept = groups.filter(group => keep.has(seriesKey(ctx, group)));
  let rest = groups.filter(group => !keep.has(seriesKey(ctx, group)));

  if (!rest.length) return { groups: kept.sort(sort), truncated: false };
  if (!query.other) return { groups: kept.sort(sort), truncated: true };

  let others = mergeToOther(ctx, rest);
  return { groups: [...kept, ...others].sort(sort), truncated: false, merged: others };
};

let formatDim = (ctx: Context, dimension: BoundDimension, value: unknown): CellValue => {
  if (value === otherValue || value === null || value === undefined)
    return (value ?? null) as CellValue;

  let source = dimension.field.source;
  if (source.kind == 'time' && typeof value == 'number')
    return formatInZone(new Date(value), ctx.query.timeZone);
  if (source.kind == 'cyclic' && source.unit == 'dayOfWeek' && typeof value == 'number') {
    return dayNames[value - 1] ?? null;
  }
  if (typeof value == 'string' || typeof value == 'number' || typeof value == 'boolean')
    return value;

  return String(value);
};

let outputColumns = (query: BoundQuery) => {
  let visible = query.measures.filter(measure => !measure.hidden);
  return visible.flatMap(measure => {
    if (!query.compare) return [measure.name];

    let columns = previousColumns(measure.name);
    return [measure.name, columns.previous, columns.delta, columns.change];
  });
};

let measureType = (measure: BoundMeasure) => {
  if (measure.kind == 'aggregate') return measure.type;
  if (measure.kind == 'derived')
    return measure.format == 'money'
      ? 'money'
      : measure.format == 'duration'
        ? 'duration'
        : 'number';
  if (measure.kind == 'composite') return 'composite';

  return 'reported';
};

export let columnsOf = (query: BoundQuery): Column[] => [
  ...query.dimensions.map(dimension => ({
    name: dimension.name,
    role: 'dimension' as const,
    type: dimension.bins ? 'string' : dimension.field.type,
    ...(dimension.field.entityKind ? { entityKind: dimension.field.entityKind } : {})
  })),
  ...query.measures
    .filter(measure => !measure.hidden)
    .flatMap(measure => {
      let type = measureType(measure);
      let column: Column = {
        name: measure.name,
        role: measure.kind == 'derived' ? 'derived' : 'measure',
        type,
        ...(type == 'money' ? { unit: 'USD' } : {}),
        ...(measure.kind == 'derived' && measure.format ? { format: measure.format } : {}),
        ...(measure.kind != 'derived'
          ? {
              additive:
                measure.kind != 'aggregate' || measure.fn == 'sum' || measure.fn == 'count'
            }
          : {})
      };
      if (!query.compare) return [column];

      let columns = previousColumns(measure.name);
      return [
        column,
        { ...column, name: columns.previous, role: 'compare' as const },
        {
          name: columns.delta,
          role: 'compare' as const,
          type: type == 'composite' ? 'number' : type
        },
        { name: columns.change, role: 'compare' as const, type: 'number', format: 'percent' }
      ];
    })
];

let totalsOf = (ctx: Context, input: FinalizeInput, groups: Group[]) => {
  if (!ctx.query.totals) return null;

  let total: Group;
  if (input.totals) {
    let decoded = [
      ...decode(
        { ...input, query: { ...ctx.query, dimensions: [] } },
        input.totals,
        ctx.warnings
      ).values()
    ];
    total = decoded[0] ?? emptyGroup([], true);
  } else {
    total = emptyGroup([], true);
    for (let group of groups) mergeInto(total, group);
    total.filled = true;
  }

  computeBase({ ...ctx, zero: true }, [total]);
  for (let measure of ctx.query.measures) {
    if (measure.kind != 'derived') continue;

    let value = evaluateExpr(measure.expr as Expr, {
      value: name => numberOf(total.values.get(name)),
      window: expr => ('shareOfTotal' in expr || 'shareWithin' in expr ? 1 : null)
    });
    total.values.set(
      measure.name,
      value === null || !Number.isFinite(value) ? null : round(value)
    );
  }

  let result: Record<string, CellValue> = {};
  for (let measure of ctx.query.measures) {
    if (!measure.hidden) result[measure.name] = total.values.get(measure.name) ?? null;
  }

  return result;
};

export let finalize = (input: FinalizeInput): FinalResult => {
  let { query } = input;
  let warnings = [...query.warnings];
  let ctx: Context = {
    query,
    warnings,
    zero: query.fill.time == 'zero',
    timeIndex: query.dimensions.findIndex(isTime)
  };

  let decoded = decode(input, input.main, warnings);
  for (let [id, group] of decoded) {
    let excluded = query.dimensions.some(
      (dimension, index) => dimension.missing == 'exclude' && group.dims[index] === null
    );
    if (excluded) decoded.delete(id);
  }

  let base = [...decoded.values()];
  fillTime(ctx, decoded);
  fillGroups(ctx, decoded, input.groupValues);

  let groups = [...decoded.values()];
  let truncated = !!input.main.truncated;
  if (groups.length > maxGroups) {
    truncated = true;
    warn(warnings, 'groups_capped', `Results stop at ${maxGroups} groups.`);
  }

  computeValues(ctx, groups);

  if (input.compare && query.compare) {
    let compared = [...decode(input, input.compare, warnings).values()];
    computeValues(ctx, compared);
    joinCompare(ctx, groups, compared);
  }

  if (query.having) groups = groups.filter(group => matchesHaving(ctx, query.having!, group));
  groups = suppressSmallGroups(ctx, input, groups);

  let limited = cut(ctx, groups);
  if (limited.merged?.length) {
    computeBase(ctx, limited.merged);
    computeDerived(ctx, limited.groups);
  }
  truncated ||= limited.truncated;

  let outputs = outputColumns(query);
  let rows = limited.groups.map(group => {
    let row: Record<string, CellValue> = {};
    query.dimensions.forEach((dimension, index) => {
      row[dimension.name] = formatDim(ctx, dimension, group.dims[index]);
    });
    for (let column of outputs) row[column] = (group.values.get(column) ?? null) as CellValue;

    return row;
  });

  return {
    columns: columnsOf(query),
    rows,
    totals: totalsOf(ctx, input, base),
    truncated,
    warnings
  };
};
