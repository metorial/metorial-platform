import {
  aggregateFns,
  datasetNames,
  derivedFormats,
  filterOps,
  queryLanguageVersion,
  queryLimits,
  queryModes,
  rangePresets,
  type Compare,
  type Derived,
  type Dimension,
  type Expr,
  type Filter,
  type FilterValue,
  type Measure,
  type OrderBy,
  type Query,
  type QueryError,
  type Range
} from './types';

let nameMaxLength = 128;
let stringValueMaxLength = 512;
let cursorMaxLength = 2048;
let exprMaxDepth = 8;

type Ctx = { errors: QueryError[] };

let escapePointer = (segment: string | number) =>
  String(segment).replace(/~/g, '~0').replace(/\//g, '~1');

export let pointerOf = (path: (string | number)[]) =>
  path.length ? '/' + path.map(escapePointer).join('/') : '';

let report = (ctx: Ctx, path: (string | number)[], code: string, message: string) => {
  ctx.errors.push({ code, message, pointer: pointerOf(path) });
};

let isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value == 'object' && value !== null && !Array.isArray(value);

let describe = (value: unknown) =>
  value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;

let closestOf = (value: string, options: readonly string[]) => {
  let lower = value.toLowerCase();
  let prefixed = options
    .filter(option => option.length > 1 && lower.startsWith(option.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  if (prefixed) return prefixed;

  let best: string | null = null;
  let bestDistance = Infinity;

  for (let option of options) {
    let distance = editDistance(value.toLowerCase(), option.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = option;
    }
  }

  return best !== null && bestDistance <= Math.max(2, Math.floor(value.length / 3))
    ? best
    : null;
};

export let editDistance = (a: string, b: string) => {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i++) {
    let current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + (a[i - 1] == b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }

  return previous[b.length]!;
};

export let suggestion = (value: string, options: readonly string[]) => {
  let closest = closestOf(value, options);
  return closest ? ` Did you mean "${closest}"?` : '';
};

let object = (
  ctx: Ctx,
  value: unknown,
  path: (string | number)[],
  keys: readonly string[]
): Record<string, unknown> | null => {
  if (!isObject(value)) {
    report(ctx, path, 'invalid_type', `Expected an object, got ${describe(value)}.`);
    return null;
  }

  for (let key of Object.keys(value)) {
    if (!keys.includes(key)) {
      report(
        ctx,
        [...path, key],
        'unknown_key',
        `Unknown key "${key}".${suggestion(key, keys)}`
      );
    }
  }

  return value;
};

let string = (
  ctx: Ctx,
  value: unknown,
  path: (string | number)[],
  maxLength = nameMaxLength
): string | undefined => {
  if (typeof value != 'string') {
    report(ctx, path, 'invalid_type', `Expected a string, got ${describe(value)}.`);
    return undefined;
  }
  if (!value.length) {
    report(ctx, path, 'too_short', 'Expected a non-empty string.');
    return undefined;
  }
  if (value.length > maxLength) {
    report(ctx, path, 'too_long', `Expected at most ${maxLength} characters.`);
    return undefined;
  }

  return value;
};

let oneOf = <T extends string>(
  ctx: Ctx,
  value: unknown,
  path: (string | number)[],
  options: readonly T[]
): T | undefined => {
  if (typeof value != 'string' || !options.includes(value as T)) {
    let hint = typeof value == 'string' ? suggestion(value, options) : '';
    report(
      ctx,
      path,
      'invalid_enum',
      `Expected one of ${options.map(option => `"${option}"`).join(', ')}.${hint}`
    );
    return undefined;
  }

  return value as T;
};

let boolean = (ctx: Ctx, value: unknown, path: (string | number)[]) => {
  if (typeof value != 'boolean') {
    report(ctx, path, 'invalid_type', `Expected a boolean, got ${describe(value)}.`);
    return undefined;
  }

  return value;
};

let number = (
  ctx: Ctx,
  value: unknown,
  path: (string | number)[],
  opts: {
    integer?: boolean;
    min?: number;
    max?: number;
    exclusiveMin?: number;
    exclusiveMax?: number;
  } = {}
) => {
  if (typeof value != 'number' || !Number.isFinite(value)) {
    report(ctx, path, 'invalid_type', `Expected a finite number, got ${describe(value)}.`);
    return undefined;
  }
  if (opts.integer && !Number.isInteger(value)) {
    report(ctx, path, 'invalid_type', 'Expected an integer.');
    return undefined;
  }
  if (opts.min !== undefined && value < opts.min) {
    report(ctx, path, 'too_small', `Expected at least ${opts.min}.`);
    return undefined;
  }
  if (opts.max !== undefined && value > opts.max) {
    report(ctx, path, 'too_big', `Expected at most ${opts.max}.`);
    return undefined;
  }
  if (opts.exclusiveMin !== undefined && value <= opts.exclusiveMin) {
    report(ctx, path, 'too_small', `Expected more than ${opts.exclusiveMin}.`);
    return undefined;
  }
  if (opts.exclusiveMax !== undefined && value >= opts.exclusiveMax) {
    report(ctx, path, 'too_big', `Expected less than ${opts.exclusiveMax}.`);
    return undefined;
  }

  return value;
};

let array = (
  ctx: Ctx,
  value: unknown,
  path: (string | number)[],
  opts: { min?: number; max: number }
): unknown[] | null => {
  if (!Array.isArray(value)) {
    report(ctx, path, 'invalid_type', `Expected an array, got ${describe(value)}.`);
    return null;
  }
  if (opts.min !== undefined && value.length < opts.min) {
    report(ctx, path, 'too_short', `Expected at least ${opts.min} item(s).`);
    return null;
  }
  if (value.length > opts.max) {
    report(ctx, path, 'too_long', `Expected at most ${opts.max} items.`);
    return null;
  }

  return value;
};

let isoPattern =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

let isoDate = (ctx: Ctx, value: unknown, path: (string | number)[]) => {
  let text = string(ctx, value, path, 40);
  if (text === undefined) return undefined;

  if (!isoPattern.test(text) || Number.isNaN(Date.parse(text))) {
    report(ctx, path, 'invalid_date', 'Expected an ISO 8601 date or date-time.');
    return undefined;
  }

  return text;
};

export let durationPattern = /^(\d{1,4})(m|h|d|w|mo|y)$/;

let parseRange = (ctx: Ctx, value: unknown, path: (string | number)[]): Range | undefined => {
  if (!isObject(value)) {
    report(ctx, path, 'invalid_type', `Expected an object, got ${describe(value)}.`);
    return undefined;
  }

  if ('preset' in value) {
    let input = object(ctx, value, path, ['preset']);
    let preset = input && oneOf(ctx, input.preset, [...path, 'preset'], rangePresets);
    return preset ? { preset } : undefined;
  }

  if ('last' in value) {
    let input = object(ctx, value, path, ['last']);
    let last = input && string(ctx, input.last, [...path, 'last'], 8);
    if (last === undefined || last === null) return undefined;

    let match = durationPattern.exec(last);
    if (!match || Number(match[1]) == 0) {
      report(
        ctx,
        [...path, 'last'],
        'invalid_duration',
        'Expected a duration like "15m", "24h", "7d", "12w", "6mo" or "1y".'
      );
      return undefined;
    }

    return { last };
  }

  let input = object(ctx, value, path, ['from', 'to']);
  if (!input) return undefined;

  let from = isoDate(ctx, input.from, [...path, 'from']);
  let to = isoDate(ctx, input.to, [...path, 'to']);

  return from && to ? { from, to } : undefined;
};

let filterValue = (
  ctx: Ctx,
  value: unknown,
  path: (string | number)[]
): FilterValue | undefined => {
  if (typeof value == 'string') {
    if (value.length > stringValueMaxLength) {
      report(ctx, path, 'too_long', `Expected at most ${stringValueMaxLength} characters.`);
      return undefined;
    }
    return value;
  }
  if (typeof value == 'boolean') return value;
  if (typeof value == 'number' && Number.isFinite(value)) return value;

  report(
    ctx,
    path,
    'invalid_type',
    `Expected a string, number or boolean, got ${describe(value)}.`
  );
  return undefined;
};

let listOps = new Set(['in', 'notIn', 'any', 'all', 'none']);
let noValueOps = new Set(['isNull', 'notNull']);

type FilterStats = { leaves: number };

let parseFilter = (
  ctx: Ctx,
  value: unknown,
  path: (string | number)[],
  depth: number,
  stats: FilterStats
): Filter | undefined => {
  if (!isObject(value)) {
    report(ctx, path, 'invalid_type', `Expected a filter object, got ${describe(value)}.`);
    return undefined;
  }

  if (depth > queryLimits.filterDepth) {
    report(ctx, path, 'too_deep', `Filters nest at most ${queryLimits.filterDepth} levels.`);
    return undefined;
  }

  if ('and' in value || 'or' in value) {
    let key = 'and' in value ? 'and' : 'or';
    let input = object(ctx, value, path, [key]);
    let items =
      input &&
      array(ctx, input[key], [...path, key], { min: 1, max: queryLimits.filterLeaves });
    if (!items) return undefined;

    let children = items.map((item, index) =>
      parseFilter(ctx, item, [...path, key, index], depth + 1, stats)
    );
    if (children.some(child => !child)) return undefined;

    return key == 'and' ? { and: children as Filter[] } : { or: children as Filter[] };
  }

  if ('not' in value) {
    let input = object(ctx, value, path, ['not']);
    let child = input && parseFilter(ctx, input.not, [...path, 'not'], depth + 1, stats);
    return child ? { not: child } : undefined;
  }

  let input = object(ctx, value, path, ['field', 'op', 'value']);
  if (!input) return undefined;

  stats.leaves++;
  if (stats.leaves == queryLimits.filterLeaves + 1) {
    report(
      ctx,
      path,
      'too_many_leaves',
      `Filters have at most ${queryLimits.filterLeaves} conditions.`
    );
  }

  let field = string(ctx, input.field, [...path, 'field']);
  let op = oneOf(ctx, input.op, [...path, 'op'], filterOps);
  if (!field || !op) return undefined;

  if (noValueOps.has(op)) {
    if (input.value !== undefined) {
      report(ctx, [...path, 'value'], 'unexpected_value', `"${op}" takes no value.`);
      return undefined;
    }
    return { field, op };
  }

  if (listOps.has(op) || op == 'between') {
    let max = op == 'between' ? 2 : queryLimits.listValues;
    let items = array(ctx, input.value, [...path, 'value'], {
      min: op == 'between' ? 2 : 0,
      max
    });
    if (!items) return undefined;

    let values = items.map((item, index) => filterValue(ctx, item, [...path, 'value', index]));
    if (values.some(item => item === undefined)) return undefined;

    return { field, op, value: values as FilterValue[] };
  }

  if (Array.isArray(input.value)) {
    report(
      ctx,
      [...path, 'value'],
      'invalid_type',
      `"${op}" takes a single value, not a list.`
    );
    return undefined;
  }

  let single = filterValue(ctx, input.value, [...path, 'value']);
  return single === undefined ? undefined : { field, op, value: single };
};

let parseDimension = (
  ctx: Ctx,
  value: unknown,
  path: (string | number)[]
): Dimension | undefined => {
  if (typeof value == 'string') return string(ctx, value, path);

  let input = object(ctx, value, path, ['field', 'as', 'bins', 'level', 'missing']);
  if (!input) return undefined;

  let field = string(ctx, input.field, [...path, 'field']);
  if (!field) return undefined;

  let result: Dimension = { field };

  if (input.as !== undefined) {
    let as = string(ctx, input.as, [...path, 'as']);
    if (as) result.as = as;
  }
  if (input.bins !== undefined) {
    let bins = array(ctx, input.bins, [...path, 'bins'], { min: 1, max: queryLimits.bins });
    if (bins) {
      let edges = bins.map((edge, index) => number(ctx, edge, [...path, 'bins', index]));
      if (edges.every(edge => edge !== undefined)) {
        let sorted = edges as number[];
        if (sorted.some((edge, index) => index > 0 && edge <= sorted[index - 1]!)) {
          report(
            ctx,
            [...path, 'bins'],
            'unsorted_bins',
            'Bin edges must be strictly increasing.'
          );
        } else {
          result.bins = sorted;
        }
      }
    }
  }
  if (input.level !== undefined) {
    if (input.level === 'all') result.level = 'all';
    else {
      let level = number(ctx, input.level, [...path, 'level'], {
        integer: true,
        min: 0,
        max: 10
      });
      if (level !== undefined) result.level = level;
    }
  }
  if (input.missing !== undefined) {
    let missing = oneOf(ctx, input.missing, [...path, 'missing'], [
      'null',
      'exclude'
    ] as const);
    if (missing) result.missing = missing;
  }

  return result;
};

let parseMeasure = (
  ctx: Ctx,
  value: unknown,
  path: (string | number)[]
): Measure | undefined => {
  if (typeof value == 'string') return string(ctx, value, path);

  let input = object(ctx, value, path, ['fn', 'field', 'q', 'where', 'as']);
  if (!input) return undefined;

  let fn = oneOf(ctx, input.fn, [...path, 'fn'], aggregateFns);
  if (!fn) return undefined;

  let result: Measure = { fn };

  if (input.field !== undefined) {
    let field = string(ctx, input.field, [...path, 'field']);
    if (field) result.field = field;
  } else if (fn != 'count') {
    report(ctx, [...path, 'field'], 'required', `"${fn}" needs a field.`);
  }

  if (fn == 'percentile') {
    let q = number(ctx, input.q, [...path, 'q'], { exclusiveMin: 0, exclusiveMax: 1 });
    if (q !== undefined) result.q = q;
  } else if (input.q !== undefined) {
    report(ctx, [...path, 'q'], 'unexpected_value', '"q" is only allowed with "percentile".');
  }

  if (input.where !== undefined) {
    let where = parseFilter(ctx, input.where, [...path, 'where'], 1, { leaves: 0 });
    if (where) result.where = where;
  }
  if (input.as !== undefined) {
    let as = string(ctx, input.as, [...path, 'as']);
    if (as) result.as = as;
  }

  return result;
};

let exprKeys = [
  'add',
  'sub',
  'mul',
  'div',
  'min',
  'max',
  'abs',
  'round',
  'coalesce',
  'shareOfTotal',
  'shareWithin',
  'cumulative',
  'movingAvg',
  'rank'
] as const;

let parseExpr = (
  ctx: Ctx,
  value: unknown,
  path: (string | number)[],
  depth: number
): Expr | undefined => {
  if (depth > exprMaxDepth) {
    report(ctx, path, 'too_deep', `Expressions nest at most ${exprMaxDepth} levels.`);
    return undefined;
  }
  if (typeof value == 'number') return number(ctx, value, path);
  if (typeof value == 'string') return string(ctx, value, path);

  if (!isObject(value)) {
    report(ctx, path, 'invalid_type', `Expected an expression, got ${describe(value)}.`);
    return undefined;
  }

  let keys = Object.keys(value);
  if (keys.length != 1 || !exprKeys.includes(keys[0] as (typeof exprKeys)[number])) {
    report(
      ctx,
      path,
      'invalid_expr',
      `Expected exactly one of ${exprKeys.map(key => `"${key}"`).join(', ')}.${
        keys[0] ? suggestion(keys[0], exprKeys) : ''
      }`
    );
    return undefined;
  }

  let key = keys[0] as (typeof exprKeys)[number];
  let inner = value[key];
  let at = [...path, key];

  let list = (min: number, max: number) => {
    let items = array(ctx, inner, at, { min, max });
    if (!items) return undefined;

    let parsed = items.map((item, index) => parseExpr(ctx, item, [...at, index], depth + 1));
    return parsed.every(item => item !== undefined) ? (parsed as Expr[]) : undefined;
  };

  switch (key) {
    case 'add':
    case 'mul':
    case 'min':
    case 'max':
    case 'coalesce': {
      let items = list(1, 20);
      return items ? ({ [key]: items } as Expr) : undefined;
    }
    case 'sub':
    case 'div': {
      let items = list(2, 2);
      return items ? ({ [key]: items as [Expr, Expr] } as Expr) : undefined;
    }
    case 'abs': {
      let item = parseExpr(ctx, inner, at, depth + 1);
      return item === undefined ? undefined : { abs: item };
    }
    case 'round': {
      let items = array(ctx, inner, at, { min: 2, max: 2 });
      if (!items) return undefined;

      let item = parseExpr(ctx, items[0], [...at, 0], depth + 1);
      let digits = number(ctx, items[1], [...at, 1], { integer: true, min: 0, max: 9 });
      return item === undefined || digits === undefined
        ? undefined
        : { round: [item, digits] };
    }
    case 'shareOfTotal':
    case 'cumulative':
    case 'rank': {
      let name = string(ctx, inner, at);
      return name ? ({ [key]: name } as Expr) : undefined;
    }
    case 'shareWithin': {
      let items = array(ctx, inner, at, { min: 2, max: 2 });
      if (!items) return undefined;

      let measure = string(ctx, items[0], [...at, 0]);
      let dimension = string(ctx, items[1], [...at, 1]);
      return measure && dimension ? { shareWithin: [measure, dimension] } : undefined;
    }
    case 'movingAvg': {
      let items = array(ctx, inner, at, { min: 2, max: 2 });
      if (!items) return undefined;

      let measure = string(ctx, items[0], [...at, 0]);
      let window = number(ctx, items[1], [...at, 1], { integer: true, min: 2, max: 366 });
      return measure && window !== undefined ? { movingAvg: [measure, window] } : undefined;
    }
  }
};

let parseDerived = (
  ctx: Ctx,
  value: unknown,
  path: (string | number)[]
): Derived | undefined => {
  let input = object(ctx, value, path, ['as', 'expr', 'format']);
  if (!input) return undefined;

  let as = string(ctx, input.as, [...path, 'as']);
  let expr = parseExpr(ctx, input.expr, [...path, 'expr'], 1);
  let format =
    input.format === undefined
      ? undefined
      : oneOf(ctx, input.format, [...path, 'format'], derivedFormats);

  if (!as || expr === undefined) return undefined;

  return { as, expr, ...(format ? { format } : {}) };
};

let parseCompare = (
  ctx: Ctx,
  value: unknown,
  path: (string | number)[]
): Compare | undefined => {
  if (isObject(value) && 'range' in value) {
    let input = object(ctx, value, path, ['range']);
    let range = input && parseRange(ctx, input.range, [...path, 'range']);
    return range ? { range } : undefined;
  }

  let input = object(ctx, value, path, ['previous']);
  let previous =
    input && oneOf(ctx, input.previous, [...path, 'previous'], ['period', 'year'] as const);
  return previous ? { previous } : undefined;
};

let queryKeys = [
  'atq',
  'dataset',
  'mode',
  'range',
  'timeZone',
  'where',
  'dimensions',
  'measures',
  'derived',
  'having',
  'select',
  'orderBy',
  'limit',
  'cursor',
  'allocation',
  'compare',
  'totals',
  'other',
  'fill',
  'labels',
  'strict'
] as const;

export type ParseResult = { ok: true; query: Query } | { ok: false; errors: QueryError[] };

export let parseQuery = (value: unknown): ParseResult => {
  let ctx: Ctx = { errors: [] };
  let input = object(ctx, value, [], queryKeys);
  if (!input) return { ok: false, errors: ctx.errors };

  if (input.atq !== queryLanguageVersion) {
    report(ctx, ['atq'], 'invalid_version', `Expected "atq": "${queryLanguageVersion}".`);
  }

  let dataset = oneOf(ctx, input.dataset, ['dataset'], datasetNames);
  let range =
    input.range === undefined
      ? (report(ctx, ['range'], 'required', 'A range is required.'), undefined)
      : parseRange(ctx, input.range, ['range']);

  let query: Partial<Query> = { atq: queryLanguageVersion };
  if (dataset) query.dataset = dataset;
  if (range) query.range = range;

  if (input.mode !== undefined) {
    let mode = oneOf(ctx, input.mode, ['mode'], queryModes);
    if (mode) query.mode = mode;
  }
  if (input.timeZone !== undefined) {
    let timeZone = string(ctx, input.timeZone, ['timeZone'], 64);
    if (timeZone) query.timeZone = timeZone;
  }
  if (input.where !== undefined) {
    let where = parseFilter(ctx, input.where, ['where'], 1, { leaves: 0 });
    if (where) query.where = where;
  }
  if (input.dimensions !== undefined) {
    let items = array(ctx, input.dimensions, ['dimensions'], { max: queryLimits.dimensions });
    if (items) {
      query.dimensions = items
        .map((item, index) => parseDimension(ctx, item, ['dimensions', index]))
        .filter((item): item is Dimension => item !== undefined);
    }
  }
  if (input.measures !== undefined) {
    let items = array(ctx, input.measures, ['measures'], { max: queryLimits.measures });
    if (items) {
      query.measures = items
        .map((item, index) => parseMeasure(ctx, item, ['measures', index]))
        .filter((item): item is Measure => item !== undefined);
    }
  }
  if (input.derived !== undefined) {
    let items = array(ctx, input.derived, ['derived'], { max: queryLimits.derived });
    if (items) {
      query.derived = items
        .map((item, index) => parseDerived(ctx, item, ['derived', index]))
        .filter((item): item is Derived => item !== undefined);
    }
  }
  if (input.having !== undefined) {
    let having = parseFilter(ctx, input.having, ['having'], 1, { leaves: 0 });
    if (having) query.having = having;
  }
  if (input.select !== undefined) {
    let items = array(ctx, input.select, ['select'], { min: 1, max: queryLimits.select });
    if (items) {
      query.select = items
        .map((item, index) => string(ctx, item, ['select', index]))
        .filter((item): item is string => item !== undefined);
    }
  }
  if (input.orderBy !== undefined) {
    let items = array(ctx, input.orderBy, ['orderBy'], { max: queryLimits.orderBy });
    if (items) {
      query.orderBy = items
        .map((item, index): OrderBy | undefined => {
          let order = object(ctx, item, ['orderBy', index], ['by', 'direction']);
          let by = order && string(ctx, order.by, ['orderBy', index, 'by']);
          if (!order || !by) return undefined;

          let direction =
            order.direction === undefined
              ? undefined
              : oneOf(ctx, order.direction, ['orderBy', index, 'direction'], [
                  'asc',
                  'desc'
                ] as const);

          return { by, ...(direction ? { direction } : {}) };
        })
        .filter((item): item is OrderBy => item !== undefined);
    }
  }
  if (input.limit !== undefined) {
    let limit = number(ctx, input.limit, ['limit'], {
      integer: true,
      min: 1,
      max: queryLimits.maxLimit
    });
    if (limit !== undefined) query.limit = limit;
  }
  if (input.cursor !== undefined) {
    let cursor = string(ctx, input.cursor, ['cursor'], cursorMaxLength);
    if (cursor) query.cursor = cursor;
  }
  if (input.allocation !== undefined) {
    let allocation = oneOf(ctx, input.allocation, ['allocation'], ['full', 'split'] as const);
    if (allocation) query.allocation = allocation;
  }
  if (input.compare !== undefined) {
    let compare = parseCompare(ctx, input.compare, ['compare']);
    if (compare) query.compare = compare;
  }
  for (let key of ['totals', 'other', 'labels', 'strict'] as const) {
    if (input[key] === undefined) continue;

    let flag = boolean(ctx, input[key], [key]);
    if (flag !== undefined) query[key] = flag;
  }
  if (input.fill !== undefined) {
    let fill = object(ctx, input.fill, ['fill'], ['time', 'groups']);
    if (fill) {
      query.fill = {};
      if (fill.time !== undefined) {
        let time = oneOf(ctx, fill.time, ['fill', 'time'], ['zero', 'null'] as const);
        if (time) query.fill.time = time;
      }
      if (fill.groups !== undefined) {
        let groups = boolean(ctx, fill.groups, ['fill', 'groups']);
        if (groups !== undefined) query.fill.groups = groups;
      }
    }
  }

  if (ctx.errors.length) return { ok: false, errors: ctx.errors };

  return { ok: true, query: query as Query };
};
